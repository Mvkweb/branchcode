import { useState, useRef, useCallback } from 'react';
import { Channel } from '@tauri-apps/api/core';
import {
  sendMessage as tauriSendMessage,
  getMessages,
  type StreamEvent,
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
  contextTokens: number; // input + cache for % calculation
  cost: number;
}

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

// Pagination: load last N messages first for fast initial render
const PAGE_SIZE = 30;

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const streamContentRef = useRef('');
  const reasoningRef = useRef('');
  const toolCallsRef = useRef<{ name: string; input: string; status: string }[]>([]);
  const toolResultsRef = useRef<{ name: string; output: string }[]>([]);
  const fileEditsRef = useRef<string[]>([]);
  const loadingRef = useRef(false);
  const loadRequestRef = useRef(0);
  const streamingSessionRef = useRef<string | null>(null);
  const lastUsageRef = useRef<SessionUsage>({
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 0,
    contextTokens: 0,
    cost: 0,
  });

  const loadMessages = useCallback(async (sessionId: string) => {
    const requestId = ++loadRequestRef.current;
    setIsLoading(true);

    try {
      const ocMessages = await getMessages(sessionId);

      if (requestId !== loadRequestRef.current) return;
      if (streamingSessionRef.current === sessionId) return;

      // Fast path: map only the last PAGE_SIZE messages
      const totalLen = ocMessages.length;
      const startIdx = Math.max(0, totalLen - PAGE_SIZE);
      
      const mapped: Message[] = [];
      
      for (let i = startIdx; i < totalLen; i++) {
        const m = ocMessages[i]!;
        const parts = (m.parts ?? []) as any[];
        
        let textContent = '';
        let reasoningContent = '';
        const toolCalls: { name: string; input: string; status: string }[] = [];
        const toolResults: { name: string; output: string }[] = [];
        const fileEdits: string[] = [];

        for (const p of parts) {
          // Handle various type field names and formats
          const partType = (p.type || p.part_type || p.partType || '').toString().toLowerCase();
          const textValue = p.text || p.content || p.text_content || '';
          
          if (partType === 'text') {
            textContent += textValue;
          } else if (partType === 'reasoning' || partType === 'thinking' || partType === 'thought') {
            reasoningContent += textValue;
          } else if (partType === 'tool') {
            const tcName = p.name || p.tool || 'unknown';
            toolCalls.push({
              name: tcName,
              input: typeof p.input === 'string' ? p.input : '',
              status: p.status || 'completed',
            });
          } else if (partType === 'tool_result' || partType === 'tool_result') {
            toolResults.push({
              name: p.name || p.tool || 'unknown',
              output: typeof p.output === 'string' ? p.output : '',
            });
          } else if (partType === 'file') {
            const path = p.path || p.file || '';
            if (path) fileEdits.push(path);
          } else if (textValue && !partType) {
            // If no type but has text, treat as text content
            textContent += textValue;
          }
        }

        // Debug: log part types for first message
        if (i === startIdx) {
          const debug = parts.map((p: any) => ({ 
            type: p.type || p.part_type, 
            hasText: !!(p.text || p.content),
            text: (p.text || p.content || '').substring(0, 100)
          }));
          console.log('Message parts:', debug);
        }

        const tokens = m.info.tokens ? extractTokens(m.info.tokens) : undefined;
        const cost = typeof m.info.cost === 'number' ? m.info.cost : undefined;

        mapped.push({
          id: m.info.id,
          role: m.info.role as 'user' | 'assistant',
          content: textContent,
          reasoning: reasoningContent || undefined,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          toolResults: toolResults.length > 0 ? toolResults : undefined,
          fileEdits: fileEdits.length > 0 ? fileEdits : undefined,
          tokens,
          cost,
        });
      }

      setMessages(mapped);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load messages:', err);
      setIsLoading(false);
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
        reasoning: '',
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
                (t) => t.name === event.data.name
              );

              if (existingIdx >= 0) {
                const existing = toolCallsRef.current[existingIdx];
                if (existing) {
                  if (event.data.status) existing.status = event.data.status;
                  if (event.data.input) existing.input = event.data.input;
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
                    content: streamContentRef.current || event.data.full_text || '',
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
                    tokens: doneTokens || msg.tokens,
                    cost: doneCost ?? msg.cost,
                  }
                : msg
            );
            
            // Reconcile with canonical backend state so final tokens/cost are correct
            setTimeout(() => {
              void loadMessages(sessionId);
            }, 500);

            // Trigger git refresh after chat completes
            window.dispatchEvent(new CustomEvent('git-refresh'));
            break;

          case 'usage':
            if (event.data.tokens) {
              const usageTokens = extractTokens(event.data.tokens);
              const usageCost = event.data.cost;

              updateAssistant((msg) =>
                msg.streaming
                  ? { ...msg, tokens: usageTokens, cost: usageCost ?? msg.cost }
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
    [isStreaming, loadMessages]
  );

  const clearMessages = useCallback(() => {
    loadRequestRef.current += 1;
    streamingSessionRef.current = null;
    setMessages([]);
    setIsStreaming(false);
    setIsLoading(false);
    setStatus(null);
  }, []);

  const getSessionUsage = useCallback((): SessionUsage => {
    let inputTokens = 0;
    let outputTokens = 0;
    let reasoningTokens = 0;
    let cacheReadTokens = 0;
    let cacheWriteTokens = 0;
    let cost = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg && msg.role === 'assistant' && msg.tokens) {
        inputTokens += msg.tokens.input;
        outputTokens += msg.tokens.output;
        reasoningTokens += msg.tokens.reasoning;
        cacheReadTokens += msg.tokens.cacheRead;
        cacheWriteTokens += msg.tokens.cacheWrite;
        cost += msg.cost || 0;
        break;
      }
    }

    const contextTokens = inputTokens + cacheReadTokens + cacheWriteTokens;
    const totalTokens = inputTokens + outputTokens + reasoningTokens + cacheReadTokens + cacheWriteTokens;

    const result: SessionUsage = {
      inputTokens,
      outputTokens,
      reasoningTokens,
      cacheReadTokens,
      cacheWriteTokens,
      totalTokens,
      contextTokens,
      cost,
    };

    if (result.totalTokens > 0) {
      lastUsageRef.current = result;
    }

    return result.totalTokens > 0 ? result : lastUsageRef.current;
  }, [messages]);

  return { messages, isStreaming, isLoading, status, send, loadMessages, clearMessages, getSessionUsage };
}
