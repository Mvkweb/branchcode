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
    pub part_type: Option<String>,
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
        
        // Handle case where type might be under a different field or missing
        if self.part_type.is_none() {
            // Try to infer from other fields
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

    pub async fn get_available_free_models(&self) -> Result<Vec<String>, String> {
        let resp = self
            .client
            .get("https://opencode.ai/zen/v1/models")
            .timeout(Duration::from_secs(8))
            .send()
            .await
            .map_err(|e| format!("Failed to fetch zen models: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("Zen API returned status: {}", resp.status()));
        }

        let data: Value = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse zen models: {}", e))?;

        let models: Vec<String> = data
            .get("data")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|m| m.get("id").and_then(|v| v.as_str()))
                    .filter(|id| id.ends_with("-free"))
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default();

        Ok(models)
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

        println!("Raw messages response: {}", serde_json::to_string_pretty(&raw).unwrap_or_default().chars().take(2000).collect::<String>());

        let messages: Vec<OcMessageResponse> = serde_json::from_value(raw.clone())
            .map_err(|e| format!("Failed to deserialize messages: {}\nRaw: {}", e, &raw.to_string().chars().take(500).collect::<String>()))?;
        
        // Log first message part types for debugging
        if let Some(first) = messages.first() {
            println!("First message parts: {:?}", first.parts.iter().map(|p| (&p.part_type, &p.text)).collect::<Vec<_>>());
        }

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

    fn part_type_from_value(v: &Value) -> Option<String> {
        v.get("type")
            .or_else(|| v.get("partType"))
            .or_else(|| v.get("part_type"))
            .and_then(|x| x.as_str())
            .map(|s| s.to_lowercase())
    }

    fn is_reasoning_type(t: &str) -> bool {
        matches!(t, "reasoning" | "thinking" | "thought")
    }

    fn get_str<'a>(v: &'a Value, keys: &[&str]) -> Option<&'a str> {
        for key in keys {
            if let Some(s) = v.get(*key).and_then(|x| x.as_str()) {
                return Some(s);
            }
        }
        None
    }

    fn get_message_id(v: &Value) -> Option<String> {
        Self::get_str(v, &["id", "messageID", "messageId", "message_id"])
            .map(|s| s.to_string())
    }

    fn get_part_id(v: &Value) -> Option<String> {
        Self::get_str(v, &["id", "partID", "partId", "part_id"])
            .map(|s| s.to_string())
    }

    fn get_role(v: &Value) -> Option<String> {
        v.get("role")
            .and_then(|x| x.as_str())
            .map(|s| s.to_lowercase())
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
        let mut delta_parts: std::collections::HashSet<String> = std::collections::HashSet::new();
        let mut part_types: std::collections::HashMap<String, String> = std::collections::HashMap::new();
        let mut message_roles: std::collections::HashMap<String, String> = std::collections::HashMap::new();
        let part_message_ids: std::collections::HashMap<String, String> = std::collections::HashMap::new();
        let mut assistant_message_id: Option<String> = None;
        let mut step_stopped = false;

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
                    "message.updated" | "message.added" => {
                        let info = props
                            .get("info")
                            .or_else(|| props.get("message"))
                            .cloned()
                            .unwrap_or(Value::Null);

                        if let (Some(msg_id), Some(role)) = (
                            Self::get_message_id(&info),
                            Self::get_role(&info),
                        ) {
                            if role == "user" {
                                // Track the user message ID so we can skip its parts
                            } else if role == "assistant" {
                                assistant_message_id = Some(msg_id.clone());
                            }
                            message_roles.insert(msg_id, role);
                        }

                        // Always send usage events (for both user and assistant)
                        let tokens = info.get("tokens").cloned();
                        let cost = info.get("cost").and_then(|v| v.as_f64());

                        if let Some(t) = tokens.clone() {
                            last_tokens = Some(t.clone());
                            last_cost = cost;
                            let _ = channel.send(OcStreamEvent::Usage {
                                tokens: t,
                                cost,
                            });
                        }
                    }
                    "message.part.delta" => {
                        // Skip deltas until we've identified the assistant message
                        if assistant_message_id.is_none() {
                            continue;
                        }

                        let field = props.get("field").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
                        let part = props.get("part").cloned().unwrap_or(Value::Null);

                        let part_id = Self::get_str(&props, &["partID", "partId", "part_id"])
                            .map(|s| s.to_string())
                            .or_else(|| Self::get_part_id(&part))
                            .unwrap_or_default();

                        let message_id = Self::get_str(&props, &["messageID", "messageId", "message_id"])
                            .map(|s| s.to_string())
                            .or_else(|| {
                                if part_id.is_empty() {
                                    None
                                } else {
                                    part_message_ids.get(&part_id).cloned()
                                }
                            })
                            .or_else(|| {
                                props.get("message")
                                    .and_then(Self::get_message_id)
                            })
                            .or_else(|| {
                                part.get("message")
                                    .and_then(Self::get_message_id)
                            });

                        // Skip deltas until we've identified the assistant message
                        if assistant_message_id.is_none() {
                            continue;
                        }

                        // Ignore non-assistant messages
                        if let Some(mid) = &message_id {
                            if let Some(active_mid) = &assistant_message_id {
                                if mid != active_mid {
                                    continue;
                                }
                            } else if let Some(role) = message_roles.get(mid) {
                                if role != "assistant" {
                                    continue;
                                }
                            }
                        }

                        // Get part type from delta props, tracked types, or part object
                        let part_type = props.get("partType")
                            .or_else(|| props.get("part_type"))
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_lowercase())
                            .or_else(|| Self::part_type_from_value(&part))
                            .or_else(|| {
                                if part_id.is_empty() {
                                    None
                                } else {
                                    part_types.get(&part_id).cloned()
                                }
                            })
                            .unwrap_or_default();

                        let delta = props.get("delta").and_then(Self::value_to_string);
                        
                        if !part_id.is_empty() {
                            delta_parts.insert(part_id.clone());
                        }

                        if let Some(d) = delta {
                            let is_reasoning = Self::is_reasoning_type(&part_type)
                                || matches!(field.as_str(), "reasoning" | "thinking" | "thought");

                            if is_reasoning {
                                accumulated_reasoning.push_str(&d);
                                let _ = channel.send(OcStreamEvent::Reasoning { text: d });
                            } else {
                                accumulated_text.push_str(&d);
                                let _ = channel.send(OcStreamEvent::Token { token: d });
                            }
                        }
                    }
                    "message.part.updated" | "message.part.added" => {
                        let part = props.get("part").cloned().unwrap_or(Value::Null);
                        let part_type = Self::part_type_from_value(&part).unwrap_or_default();
                        let part_id = part.get("id").and_then(|v| v.as_str()).unwrap_or("");

                        let message_id = Self::get_str(&props, &["messageID", "messageId", "message_id"])
                            .map(|s| s.to_string())
                            .or_else(|| {
                                part.get("message")
                                    .and_then(Self::get_message_id)
                            });

                        // Skip parts until we've identified the assistant message
                        if let Some(mid) = &message_id {
                            if assistant_message_id.is_none() {
                                continue;
                            }
                            if let Some(active_mid) = &assistant_message_id {
                                if mid != active_mid {
                                    continue;
                                }
                            }
                        } else if assistant_message_id.is_none() {
                            continue;
                        }

                        // Track part types for delta classification
                        if !part_id.is_empty() && !part_type.is_empty() {
                            part_types.insert(part_id.to_string(), part_type.clone());
                        }

                        let tool_name = part
                            .get("tool")
                            .or_else(|| part.get("name"))
                            .and_then(|v| v.as_str());
                        let state = part.get("state").cloned().unwrap_or(Value::Null);
                        let state_status = state.get("status").and_then(|v| v.as_str()).unwrap_or("");

                        match part_type.as_str() {
                            "text" => {
                                // Only send text from part.updated if delta didn't fire
                                if !delta_parts.contains(part_id) {
                                    let text = part.get("text").and_then(|v| v.as_str())
                                        .or_else(|| part.get("content").and_then(|v| v.as_str()));
                                    if let Some(d) = text {
                                        if !d.is_empty() {
                                            accumulated_text.push_str(d);
                                            let _ = channel.send(OcStreamEvent::Token {
                                                token: d.to_string(),
                                            });
                                        }
                                    }
                                }
                            }
                            "reasoning" | "thinking" | "thought" => {
                                // Only send reasoning from part.updated if delta didn't fire
                                if !delta_parts.contains(part_id) {
                                    let text = part.get("text").and_then(|v| v.as_str())
                                        .or_else(|| part.get("content").and_then(|v| v.as_str()));
                                    if let Some(d) = text {
                                        if !d.is_empty() {
                                            accumulated_reasoning.push_str(d);
                                            let _ = channel.send(OcStreamEvent::Reasoning {
                                                text: d.to_string(),
                                            });
                                        }
                                    }
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
                                        status: status.clone(),
                                    });

                                    if status == "completed" {
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

                                // Extract tokens from step-finish part (it has tokens/cost in its keys)
                                let step_tokens = part.get("tokens").cloned();
                                let step_cost = part.get("cost").and_then(|v| v.as_f64());
                                if let Some(t) = step_tokens {
                                    last_tokens = Some(t);
                                    last_cost = step_cost;
                                }

                                if reason == "stop" {
                                    step_stopped = true;
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

                            // Emit Done when session goes idle AND step has stopped
                            if st == "idle" && step_stopped {
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

    pub async fn get_providers(&self) -> Result<Value, String> {
        let resp = self
            .client
            .get(&format!("{}/provider", self.base_url))
            .send()
            .await
            .map_err(|e| format!("Failed to get providers: {}", e))?;

        resp.json()
            .await
            .map_err(|e| format!("Failed to parse providers: {}", e))
    }
}
