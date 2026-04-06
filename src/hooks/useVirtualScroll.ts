import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Lightweight virtual scroll for chat messages.
 * - Only "near-viewport" messages get full rendering.
 * - Messages far outside render as lightweight placeholders.
 * - IntersectionObserver for visibility tracking.
 */
export function useVirtualMessages<T extends { id: string }>(
  messages: T[],
  overscan = 5
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState<[number, number]>([0, 20]);
  const sentinelsRef = useRef<Map<string, IntersectionObserverEntry>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Track visible indices - use simple array lookup
  const updateVisibleRange = useCallback(() => {
    const visible = sentinelsRef.current;
    if (visible.size === 0) return;
    
    let minIdx = messages.length;
    let maxIdx = 0;

    visible.forEach((entry, id) => {
      if (entry.isIntersecting) {
        // Simple linear search - fast enough for <100 messages
        for (let i = 0; i < messages.length; i++) {
          if (messages[i]!.id === id) {
            minIdx = Math.min(minIdx, i);
            maxIdx = Math.max(maxIdx, i);
            break;
          }
        }
      }
    });

    if (minIdx <= maxIdx) {
      setVisibleRange([
        Math.max(0, minIdx - overscan),
        Math.min(messages.length - 1, maxIdx + overscan),
      ]);
    }
  }, [messages, overscan]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Reset visible range when messages change
    const len = messages.length;
    if (len > 0) {
      setVisibleRange([Math.max(0, len - 20), len - 1]);
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = (entry.target as HTMLElement).dataset.msgId;
          if (id) {
            sentinelsRef.current.set(id, entry);
          }
        });
        updateVisibleRange();
      },
      {
        root: container,
        rootMargin: '200px 0px',
        threshold: 0,
      }
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, [updateVisibleRange, messages.length]);

  const observeElement = useCallback((el: HTMLElement | null, id: string) => {
    if (!el || !observerRef.current) return;
    el.dataset.msgId = id;
    observerRef.current.observe(el);
  }, []);

  const isVisible = useCallback(
    (index: number) => {
      // Always show recent messages (last 5) - they're most likely to be visible
      // This fixes the issue where messages don't show immediately after session switch
      const recentThreshold = Math.min(5, messages.length);
      if (index >= messages.length - recentThreshold) return true;
      return index >= visibleRange[0] && index <= visibleRange[1];
    },
    [visibleRange, messages.length]
  );

  return { containerRef, observeElement, isVisible };
}