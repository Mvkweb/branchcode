use std::sync::Arc;
use std::time::Duration;
use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::ipc::Channel;
use tokio::sync::oneshot;

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
    pub tokens: Option<Value>,
    pub cost: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OcToolState {
    pub input: Option<Value>,
    pub output: Option<Value>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcPart {
    #[serde(rename = "type")]
    pub part_type: String,
    pub text: Option<String>,
    pub content: Option<String>,

    #[serde(alias = "tool")]
    pub name: Option<String>,

    pub input: Option<Value>,
    pub output: Option<Value>,
    pub status: Option<String>,

    #[serde(alias = "file")]
    pub path: Option<String>,

    #[serde(default)]
    pub state: Option<OcToolState>,
}

impl OcPart {
    fn normalize(mut self) -> Self {
        if self.text.is_none() {
            self.text = self.content.clone();
        }

        if let Some(state) = &self.state {
            if self.input.is_none() {
                self.input = state.input.clone();
            }
            if self.output.is_none() {
                self.output = state.output.clone();
            }
            if self.status.is_none() {
                self.status = state.status.clone();
            }
        }

        self
    }
}

impl OcMessageResponse {
    fn normalize(mut self) -> Self {
        self.parts = self.parts.into_iter().map(OcPart::normalize).collect();
        self
    }
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
    Done { full_text: String, tokens: Option<Value>, cost: Option<f64> },

    #[serde(rename = "error")]
    Error { message: String },

    #[serde(rename = "status")]
    Status { message: String },

    #[serde(rename = "usage")]
    Usage { tokens: Value, cost: Option<f64> },
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
        let body = match title {
            Some(t) if !t.is_empty() => serde_json::json!({ "title": t }),
            _ => serde_json::json!({}),
        };

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

        let raw: Value = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse messages: {}", e))?;

        println!("Raw messages response: {}", serde_json::to_string_pretty(&raw).unwrap_or_default());

        let messages: Vec<OcMessageResponse> = serde_json::from_value(raw.clone())
            .map_err(|e| format!("Failed to deserialize messages: {}\nRaw: {}", e, &raw.to_string().chars().take(500).collect::<String>()))?;

        Ok(messages.into_iter().map(OcMessageResponse::normalize).collect())
    }

    pub async fn send_message(
        &self,
        session_id: &str,
        message: &str,
        model: &str,
        agent: Option<&str>,
        channel: &Channel<OcStreamEvent>,
    ) -> Result<String, String> {
        let (provider, model_id) = if let Some(pos) = model.find('/') {
            (model[..pos].to_string(), model[pos + 1..].to_string())
        } else {
            ("opencode".to_string(), model.to_string())
        };

        let mut body = serde_json::json!({
            "parts": [{
                "type": "text",
                "text": message
            }],
            "model": {
                "providerID": provider,
                "modelID": model_id
            }
        });

        if let Some(a) = agent {
            if !a.is_empty() {
                body["agent"] = serde_json::json!(a);
            }
        }

        // Start SSE listener with ready signal
        let (ready_tx, ready_rx) = oneshot::channel();
        let (done_tx, mut done_rx) = tokio::sync::mpsc::channel::<(String, Option<Value>, Option<f64>)>(1);

        let client_clone = self.client.clone();
        let base_url_clone = self.base_url.clone();
        let sse_handle = tokio::spawn(Self::stream_events(
            client_clone,
            base_url_clone,
            session_id.to_string(),
            channel.clone(),
            Some(ready_tx),
            Some(done_tx),
        ));

        // Wait briefly for SSE connection so early reasoning isn't missed
        let _ = tokio::time::timeout(Duration::from_secs(2), ready_rx).await;

        let _ = channel.send(OcStreamEvent::Status {
            message: format!("{} / {}", provider, model_id),
        });

        // Use prompt_async (non-blocking) to match TUI behavior
        let resp = self
            .client
            .post(&format!("{}/session/{}/prompt_async", self.base_url, session_id))
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
            sse_handle.abort();
            return Err(format!("OpenCode API error {}: {}", status, body_text));
        }

        // Wait for SSE to signal completion
        let (full_text, _tokens, _cost) = match tokio::time::timeout(Duration::from_secs(300), done_rx.recv()).await {
            Ok(Some(result)) => result,
            Ok(None) => {
                sse_handle.abort();
                return Err("SSE stream ended without completion".to_string());
            }
            Err(_) => {
                sse_handle.abort();
                return Err("Timed out waiting for response".to_string());
            }
        };

        sse_handle.abort();

        Ok(full_text)
    }

    fn value_to_string(v: &Value) -> Option<String> {
        if let Some(s) = v.as_str() {
            return Some(s.to_string());
        }

        v.get("text")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string())
    }

    fn extract_delta(props: &Value, part: &Value) -> Option<String> {
        props
            .get("delta")
            .and_then(Self::value_to_string)
            .or_else(|| props.get("text").and_then(|v| v.as_str()).map(|s| s.to_string()))
            .or_else(|| part.get("delta").and_then(Self::value_to_string))
            .or_else(|| part.get("textDelta").and_then(|v| v.as_str()).map(|s| s.to_string()))
            .or_else(|| part.get("text").and_then(|v| v.as_str()).map(|s| s.to_string()))
            .or_else(|| part.get("content").and_then(|v| v.as_str()).map(|s| s.to_string()))
    }

    async fn stream_events(
        client: Arc<Client>,
        base_url: Arc<String>,
        session_id: String,
        channel: Channel<OcStreamEvent>,
        ready_tx: Option<oneshot::Sender<()>>,
        done_tx: Option<tokio::sync::mpsc::Sender<(String, Option<Value>, Option<f64>)>>,
    ) {
        let resp = match client
            .get(&format!("{}/event", base_url))
            .send()
            .await
        {
            Ok(r) => r,
            Err(_) => return,
        };

        if let Some(tx) = ready_tx {
            let _ = tx.send(());
        }

        let mut stream = resp.bytes_stream();
        let mut buffer = String::new();
        let mut accumulated_text = String::new();
        let mut accumulated_reasoning = String::new();
        let mut last_tokens: Option<Value> = None;
        let mut last_cost: Option<f64> = None;

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
                    "message.updated" => {
                        let info = props.get("info").cloned().unwrap_or(Value::Null);
                        let tokens = info.get("tokens").cloned();
                        let cost = info.get("cost").and_then(|v| v.as_f64());

                        if let Some(t) = tokens.clone() {
                            last_tokens = Some(t);
                            last_cost = cost;
                            let _ = channel.send(OcStreamEvent::Usage {
                                tokens: tokens.unwrap(),
                                cost,
                            });
                        }
                    }
                    "message.part.delta" => {
                        let field = props.get("field").and_then(|v| v.as_str()).unwrap_or("");
                        let delta = props.get("delta").and_then(Self::value_to_string);

                        if let Some(d) = delta {
                            match field {
                                "text" => {
                                    accumulated_text.push_str(&d);
                                    let _ = channel.send(OcStreamEvent::Token { token: d });
                                }
                                "reasoning" => {
                                    accumulated_reasoning.push_str(&d);
                                    let _ = channel.send(OcStreamEvent::Reasoning { text: d });
                                }
                                _ => {}
                            }
                        }
                    }
                    "message.part.updated" | "message.part.added" => {
                        let part = props.get("part").cloned().unwrap_or(Value::Null);
                        let delta = Self::extract_delta(&props, &part);

                        let part_type = part.get("type").and_then(|v| v.as_str()).unwrap_or("");
                        let tool_name = part
                            .get("tool")
                            .or_else(|| part.get("name"))
                            .and_then(|v| v.as_str());
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

                                    if state_status == "completed" {
                                        let output = state
                                            .get("output")
                                            .map(|v| {
                                                v.as_str()
                                                    .map(|s| s.to_string())
                                                    .unwrap_or_else(|| serde_json::to_string_pretty(v).unwrap_or_default())
                                            })
                                            .unwrap_or_default();
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
                                let _ = channel.send(OcStreamEvent::StepFinish { reason: reason.clone() });

                                if reason == "stop" {
                                    let full_text = if accumulated_text.is_empty() {
                                        "[Agent completed — check the file tree for changes]".to_string()
                                    } else {
                                        accumulated_text.clone()
                                    };
                                    let _ = channel.send(OcStreamEvent::Done {
                                        full_text: full_text.clone(),
                                        tokens: last_tokens.clone(),
                                        cost: last_cost,
                                    });
                                    if let Some(ref tx) = done_tx {
                                        let _ = tx.send((full_text, last_tokens.clone(), last_cost)).await;
                                    }
                                }
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

    pub async fn get_model_info(&self, provider_id: &str, model_id: &str) -> Result<Value, String> {
        let resp = self
            .client
            .get(&format!(
                "{}/provider/{}/model/{}",
                self.base_url,
                urlencoding::encode(provider_id),
                urlencoding::encode(model_id)
            ))
            .send()
            .await
            .map_err(|e| format!("Failed to get model info: {}", e))?;

        resp.json()
            .await
            .map_err(|e| format!("Failed to parse model info: {}", e))
    }
}
