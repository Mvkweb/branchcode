use std::sync::Arc;
use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::ipc::Channel;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcSession {
    pub id: String,
    pub title: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcMessage {
    pub id: String,
    pub role: String,
    pub session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcPart {
    #[serde(rename = "type")]
    pub part_type: String,
    pub text: Option<String>,
    pub content: Option<String>,
    pub name: Option<String>,
    pub input: Option<Value>,
    pub output: Option<Value>,
    pub status: Option<String>,
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcMessageResponse {
    pub info: OcMessage,
    pub parts: Vec<OcPart>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event", content = "data")]
pub enum OcStreamEvent {
    #[serde(rename = "token")]
    Token { token: String },

    #[serde(rename = "reasoning")]
    Reasoning { text: String },

    #[serde(rename = "tool_call")]
    ToolCall { name: String, input: String, status: String },

    #[serde(rename = "tool_result")]
    ToolResult { name: String, output: String },

    #[serde(rename = "file_edit")]
    FileEdit { path: String },

    #[serde(rename = "step_start")]
    StepStart,

    #[serde(rename = "step_finish")]
    StepFinish { reason: String },

    #[serde(rename = "done")]
    Done { full_text: String },

    #[serde(rename = "error")]
    Error { message: String },

    #[serde(rename = "status")]
    Status { message: String },
}

pub struct OpenCodeClient {
    client: Arc<Client>,
    base_url: Arc<String>,
}

impl OpenCodeClient {
    pub fn new(base_url: String) -> Self {
        Self {
            client: Arc::new(Client::new()),
            base_url: Arc::new(base_url),
        }
    }

    pub async fn list_sessions(&self) -> Result<Vec<OcSession>, String> {
        let resp = self
            .client
            .get(&format!("{}/session", self.base_url))
            .send()
            .await
            .map_err(|e| format!("Failed to list sessions: {}", e))?;

        resp.json()
            .await
            .map_err(|e| format!("Failed to parse sessions: {}", e))
    }

    pub async fn create_session(&self, title: Option<String>) -> Result<OcSession, String> {
        let body = serde_json::json!({
            "title": title.unwrap_or_default()
        });

        let resp = self
            .client
            .post(&format!("{}/session", self.base_url))
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Failed to create session: {}", e))?;

        resp.json()
            .await
            .map_err(|e| format!("Failed to parse session: {}", e))
    }

    pub async fn delete_session(&self, id: &str) -> Result<bool, String> {
        let resp = self
            .client
            .delete(&format!("{}/session/{}", self.base_url, id))
            .send()
            .await
            .map_err(|e| format!("Failed to delete session: {}", e))?;

        resp.json()
            .await
            .map_err(|e| format!("Failed to parse delete response: {}", e))
    }

    pub async fn get_messages(&self, session_id: &str) -> Result<Vec<OcMessageResponse>, String> {
        let resp = self
            .client
            .get(&format!("{}/session/{}/message", self.base_url, session_id))
            .send()
            .await
            .map_err(|e| format!("Failed to get messages: {}", e))?;

        resp.json()
            .await
            .map_err(|e| format!("Failed to parse messages: {}", e))
    }

    pub async fn send_message(
        &self,
        session_id: &str,
        message: &str,
        model: &str,
        channel: &Channel<OcStreamEvent>,
    ) -> Result<String, String> {
        let (provider, model_id) = if let Some(pos) = model.find('/') {
            (model[..pos].to_string(), model[pos + 1..].to_string())
        } else {
            ("opencode".to_string(), model.to_string())
        };

        let body = serde_json::json!({
            "parts": [{
                "type": "text",
                "text": message
            }],
            "model": {
                "providerID": provider,
                "modelID": model_id
            }
        });

        // Start SSE listener
        let client_clone = self.client.clone();
        let base_url_clone = self.base_url.clone();
        let sse_handle = tokio::spawn(Self::stream_events(
            client_clone,
            base_url_clone,
            session_id.to_string(),
            channel.clone(),
        ));

        let _ = channel.send(OcStreamEvent::Status {
            message: format!("{} / {}", provider, model_id),
        });

        // Send the message (blocking, returns when done)
        let resp = self
            .client
            .post(&format!("{}/session/{}/message", self.base_url, session_id))
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Failed to send message: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body_text = resp.text().await.unwrap_or_default();
            let _ = channel.send(OcStreamEvent::Error {
                message: format!("OpenCode API error {}: {}", status, body_text),
            });
            // Abort SSE listener
            sse_handle.abort();
            return Err(format!("OpenCode API error {}: {}", status, body_text));
        }

        let result: OcMessageResponse = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        // Abort SSE listener
        sse_handle.abort();

        // Build full text from parts
        let mut full_text = String::new();
        for part in &result.parts {
            match part.part_type.as_str() {
                "text" => {
                    if let Some(text) = &part.text {
                        full_text.push_str(text);
                    }
                }
                "tool" => {
                    if let (Some(name), Some(state)) = (&part.name, &part.status) {
                        let input_str = part
                            .input
                            .as_ref()
                            .map(|v| serde_json::to_string_pretty(v).unwrap_or_default())
                            .unwrap_or_default();
                        let _ = channel.send(OcStreamEvent::ToolCall {
                            name: name.clone(),
                            input: input_str,
                            status: state.clone(),
                        });
                    }
                }
                "file" => {
                    if let Some(path) = &part.path {
                        let _ = channel.send(OcStreamEvent::FileEdit {
                            path: path.clone(),
                        });
                    }
                }
                "reasoning" => {
                    // Already streamed, just collect
                }
                _ => {}
            }
        }

        if full_text.is_empty() {
            full_text = "[Agent completed — check the file tree for changes]".to_string();
        }

        let _ = channel.send(OcStreamEvent::Done {
            full_text: full_text.clone(),
        });

        Ok(full_text)
    }

    async fn stream_events(
        client: Arc<Client>,
        base_url: Arc<String>,
        session_id: String,
        channel: Channel<OcStreamEvent>,
    ) {
        let resp = match client
            .get(&format!("{}/event", base_url))
            .send()
            .await
        {
            Ok(r) => r,
            Err(_) => return,
        };

        let mut stream = resp.bytes_stream();
        let mut buffer = String::new();

        while let Some(chunk_result) = stream.next().await {
            let chunk = match chunk_result {
                Ok(c) => c,
                Err(_) => break,
            };
            buffer.push_str(&String::from_utf8_lossy(&chunk));

            while let Some(newline_pos) = buffer.find('\n') {
                let line = buffer[..newline_pos].trim().to_string();
                buffer = buffer[newline_pos + 1..].to_string();

                if line.is_empty() || line.starts_with(':') || !line.starts_with("data: ") {
                    continue;
                }

                let data = &line[6..];
                if data == "[DONE]" {
                    break;
                }

                let event: Value = match serde_json::from_str(data) {
                    Ok(v) => v,
                    Err(_) => continue,
                };

                let event_type = event.get("type").and_then(|v| v.as_str()).unwrap_or("");
                let props = event.get("properties").cloned().unwrap_or(Value::Null);

                // Filter to this session
                let event_session = props
                    .get("sessionID")
                    .or_else(|| props.get("session_id"))
                    .and_then(|v| v.as_str());

                if let Some(es) = event_session {
                    if es != session_id {
                        continue;
                    }
                }

                match event_type {
                    "message.part.updated" => {
                        let part = props.get("part").cloned().unwrap_or(Value::Null);
                        let delta = props.get("delta").and_then(|v| v.as_str());

                        let part_type = part.get("type").and_then(|v| v.as_str()).unwrap_or("");
                        let tool_name = part.get("tool").and_then(|v| v.as_str());
                        let state = part.get("state").cloned().unwrap_or(Value::Null);
                        let state_status = state.get("status").and_then(|v| v.as_str()).unwrap_or("");

                        match part_type {
                            "text" => {
                                if let Some(d) = delta {
                                    let _ = channel.send(OcStreamEvent::Token {
                                        token: d.to_string(),
                                    });
                                }
                            }
                            "reasoning" => {
                                if let Some(d) = delta {
                                    let _ = channel.send(OcStreamEvent::Reasoning {
                                        text: d.to_string(),
                                    });
                                }
                            }
                            "tool" => {
                                if let Some(name) = tool_name {
                                    let input_str = state
                                        .get("input")
                                        .map(|v| serde_json::to_string_pretty(v).unwrap_or_default())
                                        .unwrap_or_default();
                                    let status = if state_status.is_empty() {
                                        "pending".to_string()
                                    } else {
                                        state_status.to_string()
                                    };
                                    let _ = channel.send(OcStreamEvent::ToolCall {
                                        name: name.to_string(),
                                        input: input_str,
                                        status,
                                    });

                                    // If completed, also send result
                                    if state_status == "completed" {
                                        let output = state
                                            .get("output")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("")
                                            .to_string();
                                        let _ = channel.send(OcStreamEvent::ToolResult {
                                            name: name.to_string(),
                                            output,
                                        });
                                    }
                                }
                            }
                            "step-start" => {
                                let _ = channel.send(OcStreamEvent::StepStart);
                            }
                            "step-finish" => {
                                let reason = part
                                    .get("reason")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("")
                                    .to_string();
                                let _ = channel.send(OcStreamEvent::StepFinish { reason });
                            }
                            _ => {}
                        }
                    }
                    "file.edited" => {
                        if let Some(file) = props.get("file").and_then(|v| v.as_str()) {
                            let _ = channel.send(OcStreamEvent::FileEdit {
                                path: file.to_string(),
                            });
                        }
                    }
                    "session.status" => {
                        let status_type = props
                            .get("status")
                            .and_then(|v| v.get("type"))
                            .and_then(|v| v.as_str());
                        if let Some(st) = status_type {
                            let msg = match st {
                                "busy" => "Working...".to_string(),
                                "idle" => "Done".to_string(),
                                "retry" => {
                                    let attempt = props
                                        .get("status")
                                        .and_then(|v| v.get("attempt"))
                                        .and_then(|v| v.as_u64())
                                        .unwrap_or(0);
                                    format!("Retrying (attempt {})...", attempt)
                                }
                                _ => st.to_string(),
                            };
                            let _ = channel.send(OcStreamEvent::Status { message: msg });
                        }
                    }
                    "session.error" => {
                        let error = props.get("error").cloned().unwrap_or(Value::Null);
                        let msg = error
                            .get("data")
                            .and_then(|v| v.get("message"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("Unknown error")
                            .to_string();
                        let _ = channel.send(OcStreamEvent::Error { message: msg });
                    }
                    _ => {}
                }
            }
        }
    }

    pub async fn list_files(&self, path: Option<&str>) -> Result<Value, String> {
        let url = match path {
            Some(p) => format!("{}/file?path={}", self.base_url, urlencoding::encode(p)),
            None => format!("{}/file", self.base_url),
        };

        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to list files: {}", e))?;

        resp.json()
            .await
            .map_err(|e| format!("Failed to parse file listing: {}", e))
    }

    pub async fn read_file(&self, path: &str) -> Result<Value, String> {
        let resp = self
            .client
            .get(&format!(
                "{}/file/content?path={}",
                self.base_url,
                urlencoding::encode(path)
            ))
            .send()
            .await
            .map_err(|e| format!("Failed to read file: {}", e))?;

        resp.json()
            .await
            .map_err(|e| format!("Failed to parse file content: {}", e))
    }

    pub async fn find_files(&self, query: &str) -> Result<Vec<String>, String> {
        let resp = self
            .client
            .get(&format!(
                "{}/find/file?query={}",
                self.base_url,
                urlencoding::encode(query)
            ))
            .send()
            .await
            .map_err(|e| format!("Failed to find files: {}", e))?;

        resp.json()
            .await
            .map_err(|e| format!("Failed to parse file search: {}", e))
    }
}
