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
  tokens?: { input: number; output: number; reasoning: number; cacheRead: number; cacheWrite: number };
  cost?: number;
}

export interface SessionUsage {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  cost: number;
}

const stringifySafe = (value: unknown) => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const extractTokens = (tokens: unknown) => {
  if (!tokens) return { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 };
  if (typeof tokens === 'number') return { input: 0, output: tokens, reasoning: 0, cacheRead: 0, cacheWrite: 0 };
  if (typeof tokens === 'object') {
    const t = tokens as Record<string, unknown>;
    return {
      input: (t.input as number) || 0,
      output: (t.output as number) || 0,
      reasoning: (t.reasoning as number) || 0,
      cacheRead: ((t.cache as Record<string, unknown>)?.read as number) || 0,
      cacheWrite: ((t.cache as Record<string, unknown>)?.write as number) || 0,
    };
  }
  return { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 };
};

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
  const loadRequestRef = useRef(0);
  const streamingSessionRef = useRef<string | null>(null);

  const loadMessages = useCallback(async (sessionId: string) => {
    const requestId = ++loadRequestRef.current;

    try {
      const ocMessages = await getMessages(sessionId);

      if (requestId !== loadRequestRef.current) return;
      if (streamingSessionRef.current === sessionId) return;

      const mapped: Message[] = ocMessages.map((m: OcMessageResponse) => {
        const parts = (m.parts ?? []) as any[];

        const textParts = parts
          .filter((p) => p.type === 'text')
          .map((p) => p.text || p.content || '')
          .join('');

        const reasoningParts = parts
          .filter((p) => p.type === 'reasoning')
          .map((p) => p.text || p.content || '')
          .join('');

        const toolCalls = parts
          .filter((p) => p.type === 'tool')
          .map((p) => ({
            name: p.name || p.tool || 'unknown',
            input: stringifySafe(p.input ?? p.state?.input),
            status: p.status || p.state?.status || 'completed',
          }));

        const toolResults = parts.flatMap((p) => {
          if (p.type === 'tool_result') {
            return [
              {
                name: p.name || p.tool || 'unknown',
                output: stringifySafe(p.output ?? p.content),
              },
            ];
          }

          if (p.type === 'tool' && (p.output != null || p.state?.output != null)) {
            return [
              {
                name: p.name || p.tool || 'unknown',
                output: stringifySafe(p.output ?? p.state?.output),
              },
            ];
          }

          return [];
        });

        const fileEdits = parts
          .filter((p) => p.type === 'file')
          .map((p) => p.path || p.file || '')
          .filter(Boolean);

        const tokens = m.info.tokens ? extractTokens(m.info.tokens) : undefined;
        const cost = typeof m.info.cost === 'number' ? m.info.cost : undefined;

        return {
          id: m.info.id,
          role: m.info.role as 'user' | 'assistant',
          content: textParts,
          reasoning: reasoningParts || undefined,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          toolResults: toolResults.length > 0 ? toolResults : undefined,
          fileEdits: fileEdits.length > 0 ? fileEdits : undefined,
          tokens,
          cost,
        };
      });
      setMessages(mapped);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }, []);

  const send = useCallback(
    async (sessionId: string, content: string, agent?: string) => {
      if (!content.trim() || isStreaming || loadingRef.current) return;
      loadingRef.current = true;
      streamingSessionRef.current = sessionId;
      loadRequestRef.current += 1;

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

      const assistantId = assistantMsg.id;

      const updateAssistant = (updater: (msg: Message) => Message) => {
        setMessages((prev) =>
          prev.map((msg) => (msg.id === assistantId ? updater(msg) : msg))
        );
      };

      const channel = new Channel<StreamEvent>();

      channel.onmessage = (event: StreamEvent) => {
        switch (event.event) {
          case 'token':
            if (typeof event.data.token === 'string') {
              streamContentRef.current += event.data.token;
              const currentContent = streamContentRef.current;

              updateAssistant((msg) =>
                msg.streaming
                  ? { ...msg, content: currentContent }
                  : msg
              );
            }
            break;

          case 'reasoning':
            if (typeof event.data.text === 'string') {
              reasoningRef.current += event.data.text;
              const currentReasoning = reasoningRef.current;

              updateAssistant((msg) =>
                msg.streaming
                  ? { ...msg, reasoning: currentReasoning }
                  : msg
              );
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
                  name: event.data.name,
                  input: event.data.input || '',
                  status: event.data.status || 'pending',
                });
              }

              setStatus(`${event.data.name} (${event.data.status || 'pending'})`);

              updateAssistant((msg) =>
                msg.streaming
                  ? { ...msg, toolCalls: [...toolCallsRef.current] }
                  : msg
              );
            }
            break;

          case 'tool_result':
            if (event.data.name) {
              toolResultsRef.current.push({
                name: event.data.name!,
                output: event.data.output || '',
              });

              updateAssistant((msg) =>
                msg.streaming
                  ? { ...msg, toolResults: [...toolResultsRef.current] }
                  : msg
              );
            }
            break;

          case 'file_edit':
            if (event.data.path) {
              fileEditsRef.current.push(event.data.path);

              updateAssistant((msg) =>
                msg.streaming
                  ? { ...msg, fileEdits: [...fileEditsRef.current] }
                  : msg
              );
            }
            break;

          case 'done':
            setIsStreaming(false);
            setStatus(null);
            loadingRef.current = false;
            streamingSessionRef.current = null;

            const doneTokens = event.data.tokens ? extractTokens(event.data.tokens) : undefined;
            const doneCost = event.data.cost;

            updateAssistant((msg) =>
              msg.streaming
                ? {
                    ...msg,
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
                    tokens: doneTokens,
                    cost: doneCost,
                  }
                : msg
            );
            break;

          case 'usage':
            if (event.data.tokens) {
              const usageTokens = extractTokens(event.data.tokens);
              const usageCost = event.data.cost;

              updateAssistant((msg) =>
                msg.streaming
                  ? { ...msg, tokens: usageTokens, cost: usageCost }
                  : msg
              );
            }
            break;

          case 'error':
            setIsStreaming(false);
            setStatus(null);
            loadingRef.current = false;
            streamingSessionRef.current = null;

            updateAssistant((msg) =>
              msg.streaming
                ? { ...msg, content: `Error: ${event.data.message}`, streaming: false }
                : msg
            );
            break;

          case 'status':
            setStatus(event.data.message || null);
            break;
        }
      };

      try {
        await tauriSendMessage(sessionId, content.trim(), channel, agent);
      } catch (err: any) {
        setIsStreaming(false);
        loadingRef.current = false;
        streamingSessionRef.current = null;

        updateAssistant((msg) =>
          msg.streaming
            ? { ...msg, content: `${err?.toString() || 'Unknown error'}`, streaming: false }
            : msg
        );
      }
    },
    [isStreaming]
  );

  const clearMessages = useCallback(() => {
    loadRequestRef.current += 1;
    streamingSessionRef.current = null;
    setMessages([]);
    setIsStreaming(false);
    setStatus(null);
  }, []);

  const getSessionUsage = useCallback((): SessionUsage => {
    let inputTokens = 0;
    let outputTokens = 0;
    let reasoningTokens = 0;
    let cacheReadTokens = 0;
    let cacheWriteTokens = 0;
    let cost = 0;

    // Only count the LAST assistant message's tokens (current turn)
    // Previous turns are already spent - we don't want to double-count
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg && msg.role === 'assistant' && msg.tokens) {
        inputTokens += msg.tokens.input;
        outputTokens += msg.tokens.output;
        reasoningTokens += msg.tokens.reasoning;
        cacheReadTokens += msg.tokens.cacheRead;
        cacheWriteTokens += msg.tokens.cacheWrite;
        cost += msg.cost || 0;
        break; // Only count the most recent assistant message
      }
    }

    return {
      inputTokens,
      outputTokens,
      reasoningTokens,
      cacheReadTokens,
      cacheWriteTokens,
      totalTokens: inputTokens + outputTokens + reasoningTokens + cacheReadTokens + cacheWriteTokens,
      cost,
    };
  }, [messages]);

  return { messages, isStreaming, status, send, loadMessages, clearMessages, getSessionUsage };
}
