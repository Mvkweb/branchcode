import { useState, useRef, useCallback } from 'react';
import { Channel } from '@tauri-apps/api/core';
import {
  sendMessage as tauriSendMessage,
  getMessages,
  type StreamEvent,
  type OcMessageResponse,
} from '../lib/tauri';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  toolCalls?: { name: string; input: string; status: string }[];
  toolResults?: { name: string; output: string }[];
  fileEdits?: string[];
  streaming?: boolean;
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const streamContentRef = useRef('');
  const reasoningRef = useRef('');
  const toolCallsRef = useRef<{ name: string; input: string; status: string }[]>([]);
  const toolResultsRef = useRef<{ name: string; output: string }[]>([]);
  const fileEditsRef = useRef<string[]>([]);
  const loadingRef = useRef(false);

  const loadMessages = useCallback(async (sessionId: string) => {
    try {
      const ocMessages = await getMessages(sessionId);
      const mapped: Message[] = ocMessages.map((m: OcMessageResponse) => {
        const textParts = m.parts
          .filter((p) => p.type === 'text')
          .map((p) => p.text || '')
          .join('');

        const reasoningParts = m.parts
          .filter((p) => p.type === 'reasoning')
          .map((p) => p.text || '')
          .join('');

        const toolCalls = m.parts
          .filter((p) => p.type === 'tool')
          .map((p) => ({
            name: p.name || 'unknown',
            input: p.input ? JSON.stringify(p.input, null, 2) : '',
            status: p.status || 'completed',
          }));

        const toolResults = m.parts
          .filter((p) => p.type === 'tool_result')
          .map((p) => ({
            name: p.name || 'unknown',
            output: p.output
              ? JSON.stringify(p.output, null, 2)
              : p.content || '',
          }));

        const fileEdits = m.parts
          .filter((p) => p.type === 'file')
          .map((p) => p.path || '')
          .filter(Boolean);

        return {
          id: m.info.id,
          role: m.info.role as 'user' | 'assistant',
          content: textParts,
          reasoning: reasoningParts || undefined,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          toolResults: toolResults.length > 0 ? toolResults : undefined,
          fileEdits: fileEdits.length > 0 ? fileEdits : undefined,
        };
      });
      setMessages(mapped);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }, []);

  const send = useCallback(
    async (sessionId: string, content: string) => {
      if (!content.trim() || isStreaming || loadingRef.current) return;
      loadingRef.current = true;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: content.trim(),
      };

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        streaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      streamContentRef.current = '';
      reasoningRef.current = '';
      toolCallsRef.current = [];
      toolResultsRef.current = [];
      fileEditsRef.current = [];

      const channel = new Channel<StreamEvent>();

      channel.onmessage = (event: StreamEvent) => {
        switch (event.event) {
          case 'token':
            if (event.data.token) {
              streamContentRef.current += event.data.token;
              const currentContent = streamContentRef.current;
              setMessages((prev) => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]?.streaming) {
                  updated[lastIdx] = {
                    ...updated[lastIdx],
                    content: currentContent,
                  };
                }
                return updated;
              });
            }
            break;

          case 'reasoning':
            if (event.data.text) {
              reasoningRef.current += event.data.text;
              const currentReasoning = reasoningRef.current;
              setMessages((prev) => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]?.streaming) {
                  updated[lastIdx] = {
                    ...updated[lastIdx],
                    reasoning: currentReasoning,
                  };
                }
                return updated;
              });
            }
            break;

          case 'tool_call':
            if (event.data.name) {
              const existingIdx = toolCallsRef.current.findIndex(
                (t) => t.name === event.data.name && t.status === 'pending'
              );
              if (existingIdx >= 0 && event.data.status !== 'pending') {
                const existing = toolCallsRef.current[existingIdx];
                if (existing) {
                  existing.status = event.data.status!;
                  if (event.data.input) {
                    existing.input = event.data.input;
                  }
                }
              } else {
                toolCallsRef.current.push({
                  name: event.data.name!,
                  input: event.data.input || '',
                  status: event.data.status || 'pending',
                });
              }
              setStatus(`${event.data.name} (${event.data.status || 'pending'})`);
              setMessages((prev) => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]?.streaming) {
                  updated[lastIdx] = {
                    ...updated[lastIdx],
                    toolCalls: [...toolCallsRef.current],
                  };
                }
                return updated;
              });
            }
            break;

          case 'tool_result':
            if (event.data.name) {
              toolResultsRef.current.push({
                name: event.data.name!,
                output: event.data.output || '',
              });
              setMessages((prev) => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]?.streaming) {
                  updated[lastIdx] = {
                    ...updated[lastIdx],
                    toolResults: [...toolResultsRef.current],
                  };
                }
                return updated;
              });
            }
            break;

          case 'file_edit':
            if (event.data.path) {
              fileEditsRef.current.push(event.data.path);
              setMessages((prev) => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]?.streaming) {
                  updated[lastIdx] = {
                    ...updated[lastIdx],
                    fileEdits: [...fileEditsRef.current],
                  };
                }
                return updated;
              });
            }
            break;

          case 'done':
            setIsStreaming(false);
            setStatus(null);
            loadingRef.current = false;
            setMessages((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (updated[lastIdx]?.streaming) {
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  content: event.data.full_text || streamContentRef.current,
                  streaming: false,
                  reasoning: reasoningRef.current || undefined,
                  toolCalls:
                    toolCallsRef.current.length > 0
                      ? [...toolCallsRef.current]
                      : undefined,
                  toolResults:
                    toolResultsRef.current.length > 0
                      ? [...toolResultsRef.current]
                      : undefined,
                  fileEdits:
                    fileEditsRef.current.length > 0
                      ? [...fileEditsRef.current]
                      : undefined,
                };
              }
              return updated;
            });
            break;

          case 'error':
            setIsStreaming(false);
            setStatus(null);
            loadingRef.current = false;
            setMessages((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (updated[lastIdx]?.streaming) {
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  content: `Error: ${event.data.message}`,
                  streaming: false,
                };
              }
              return updated;
            });
            break;

          case 'status':
            setStatus(event.data.message || null);
            break;
        }
      };

      try {
        await tauriSendMessage(sessionId, content.trim(), channel);
      } catch (err: any) {
        setIsStreaming(false);
        loadingRef.current = false;
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.streaming) {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: `${err?.toString() || 'Unknown error'}`,
              streaming: false,
            };
          }
          return updated;
        });
      }
    },
    [isStreaming]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setIsStreaming(false);
    setStatus(null);
  }, []);

  return { messages, isStreaming, status, send, loadMessages, clearMessages };
}
