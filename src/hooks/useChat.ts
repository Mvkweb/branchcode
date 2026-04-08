import { useState, useRef, useCallback, useEffect } from 'react';
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

type ToolCall = NonNullable<Message['toolCalls']>[number];
type ToolResult = NonNullable<Message['toolResults']>[number];

const stringifyValue = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const getPartType = (part: any): string =>
  String(part?.type ?? part?.part_type ?? part?.partType ?? '').toLowerCase();

const getPartText = (part: any): string =>
  typeof part?.text === 'string'
    ? part.text
    : typeof part?.content === 'string'
      ? part.content
      : typeof part?.text_content === 'string'
        ? part.text_content
        : '';

const getPartPath = (part: any): string | undefined => {
  const direct = part?.path ?? part?.file ?? part?.file_path ?? part?.filePath;
  if (typeof direct === 'string' && direct) return direct;

  const input = part?.input ?? part?.state?.input;
  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    const maybePath = obj.path ?? obj.file_path ?? obj.filePath;
    if (typeof maybePath === 'string' && maybePath) return maybePath;
  }

  return undefined;
};

const isEditTool = (name: string) => /edit|write|create|update|patch/i.test(name);

const dedupeBy = <T,>(items: T[], keyFn: (item: T) => string): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const joinBlocks = (a?: string, b?: string) => {
  if (!a) return b ?? '';
  if (!b) return a;
  return `${a}\n\n${b}`;
};

const mapOcMessageToUi = (m: any): Message => {
  const parts = Array.isArray(m.parts) ? m.parts : [];

  let textContent = '';
  let reasoningContent = '';
  const toolCalls: ToolCall[] = [];
  const toolResults: ToolResult[] = [];
  const fileEdits: string[] = [];

  for (const p of parts) {
    const partType = getPartType(p);
    const textValue = getPartText(p);

    if (partType === 'text' || (!partType && textValue)) {
      textContent += textValue;
      continue;
    }

    if (partType === 'reasoning' || partType === 'thinking' || partType === 'thought') {
      reasoningContent += textValue;
      continue;
    }

    if (partType === 'file' || partType === 'file_edit' || partType === 'file-edit') {
      const path = getPartPath(p);
      if (path) fileEdits.push(path);
      continue;
    }

    const name =
      typeof (p?.name ?? p?.tool) === 'string'
        ? String(p.name ?? p.tool)
        : 'unknown';

    const input = p?.input ?? p?.state?.input;
    const output = p?.output ?? p?.state?.output;
    const status =
      typeof (p?.status ?? p?.state?.status) === 'string'
        ? String(p.status ?? p.state?.status)
        : 'completed';

    if (partType === 'tool_result' || partType === 'tool-call-result') {
      toolResults.push({
        name,
        output: stringifyValue(output),
      });
      continue;
    }

    const looksLikeTool =
      partType === 'tool' ||
      partType === 'tool_call' ||
      p?.name != null ||
      p?.tool != null ||
      p?.state != null;

    if (looksLikeTool) {
      toolCalls.push({
        name,
        input: stringifyValue(input),
        status,
      });

      if (output != null && stringifyValue(output)) {
        toolResults.push({
          name,
          output: stringifyValue(output),
        });
      }

      const path = getPartPath(p);
      if (path && isEditTool(name)) {
        fileEdits.push(path);
      }
    }
  }

  const tokens = m.info?.tokens ? extractTokens(m.info.tokens) : undefined;
  const cost = typeof m.info?.cost === 'number' ? m.info.cost : undefined;

  return {
    id: m.info?.id ?? crypto.randomUUID(),
    role: (m.info?.role ?? 'assistant') as 'user' | 'assistant',
    content: textContent,
    reasoning: reasoningContent || undefined,
    toolCalls: toolCalls.length ? toolCalls : undefined,
    toolResults: toolResults.length ? toolResults : undefined,
    fileEdits: fileEdits.length ? dedupeBy(fileEdits, (x) => x) : undefined,
    tokens,
    cost,
  };
};

const mergeAssistantTurns = (items: Message[]): Message[] => {
  const merged: Message[] = [];

  for (const msg of items) {
    const last = merged[merged.length - 1];

    if (msg.role === 'assistant' && last?.role === 'assistant') {
      last.content = joinBlocks(last.content, msg.content);
      last.reasoning = joinBlocks(last.reasoning, msg.reasoning) || undefined;

      const mergedToolCalls = dedupeBy(
        [...(last.toolCalls ?? []), ...(msg.toolCalls ?? [])],
        (t) => `${t.name}|${t.input}|${t.status}`
      );
      last.toolCalls = mergedToolCalls.length ? mergedToolCalls : undefined;

      const mergedToolResults = dedupeBy(
        [...(last.toolResults ?? []), ...(msg.toolResults ?? [])],
        (t) => `${t.name}|${t.output}`
      );
      last.toolResults = mergedToolResults.length ? mergedToolResults : undefined;

      const mergedFileEdits = dedupeBy(
        [...(last.fileEdits ?? []), ...(msg.fileEdits ?? [])],
        (p) => p
      );
      last.fileEdits = mergedFileEdits.length ? mergedFileEdits : undefined;

      last.tokens = msg.tokens ?? last.tokens;
      last.cost = msg.cost ?? last.cost;
      continue;
    }

    merged.push({ ...msg });
  }

  return merged;
};

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

  // RAF batching for smooth streaming updates
  const rafIdRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef<(() => void) | null>(null);
  const assistantIdRef = useRef<string | null>(null);

  const flushUpdate = useCallback(() => {
    if (pendingUpdateRef.current) {
      pendingUpdateRef.current();
      pendingUpdateRef.current = null;
    }
    rafIdRef.current = null;
  }, []);

  const scheduleUpdate = useCallback((updater: () => void) => {
    pendingUpdateRef.current = updater;
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(flushUpdate);
    }
  }, [flushUpdate]);

  // Clean up RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const clearStreamingRefs = useCallback(() => {
    streamContentRef.current = '';
    reasoningRef.current = '';
    toolCallsRef.current = [];
    toolResultsRef.current = [];
    fileEditsRef.current = [];
    assistantIdRef.current = null;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      pendingUpdateRef.current = null;
    }
  }, []);

  const loadMessages = useCallback(async (sessionId: string) => {
    const requestId = ++loadRequestRef.current;
    setIsLoading(true);

    try {
      const ocMessages = await getMessages(sessionId);

      console.log('Backend returned messages count:', ocMessages.length);
      if (ocMessages.length > 0) {
        const firstMsg = ocMessages[0];
        console.log('First message parts count:', firstMsg?.parts?.length || 0);
        console.log('First message data:', JSON.stringify(firstMsg, null, 2).substring(0, 2000));
      }

      if (requestId !== loadRequestRef.current) return;
      if (streamingSessionRef.current === sessionId) {
        clearStreamingRefs();
        return;
      }

      // Fast path: map only the last PAGE_SIZE messages
      const totalLen = ocMessages.length;
      const startIdx = Math.max(0, totalLen - PAGE_SIZE);
      
      const rawMapped = ocMessages
        .slice(startIdx)
        .map(mapOcMessageToUi);

      const mapped = mergeAssistantTurns(rawMapped);

      setMessages(mapped);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load messages:', err);
      setIsLoading(false);
    }
  }, [clearStreamingRefs]);

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
      assistantIdRef.current = assistantId;

      const updateAssistant = (updater: (msg: Message) => Message) => {
        scheduleUpdate(() => {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === assistantId ? updater(msg) : msg))
          );
        });
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
            // Flush any pending RAF updates before finalizing
            if (rafIdRef.current !== null) {
              cancelAnimationFrame(rafIdRef.current);
              if (pendingUpdateRef.current) {
                pendingUpdateRef.current();
                pendingUpdateRef.current = null;
              }
              rafIdRef.current = null;
            }

            setIsStreaming(false);
            setStatus(null);
            loadingRef.current = false;
            streamingSessionRef.current = null;

            const doneTokens = event.data.tokens ? extractTokens(event.data.tokens) : undefined;
            const doneCost = event.data.cost;

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantIdRef.current && msg.streaming
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
              )
            );
            
            // Skip reconciliation - streaming already has correct toolCalls/fileEdits, 
            // and backend doesn't return them in a parseable format

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
        // Flush pending updates before error
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          if (pendingUpdateRef.current) {
            pendingUpdateRef.current();
            pendingUpdateRef.current = null;
          }
          rafIdRef.current = null;
        }

        setIsStreaming(false);
        loadingRef.current = false;
        streamingSessionRef.current = null;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantIdRef.current && msg.streaming
              ? { ...msg, content: `${err?.toString() || 'Unknown error'}`, streaming: false }
              : msg
          )
        );
      }
    },
    [isStreaming, loadMessages]
  );

  const clearMessages = useCallback(() => {
    loadRequestRef.current += 1;
    streamingSessionRef.current = null;
    clearStreamingRefs();
    setMessages([]);
    setIsStreaming(false);
    setIsLoading(false);
    setStatus(null);
  }, [clearStreamingRefs]);

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
