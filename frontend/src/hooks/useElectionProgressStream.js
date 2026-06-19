import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Subscribe to election worker progress via Server-Sent Events (cookie auth).
 * Replaces 2–5s HTTP polling for tally/decryption/combine modals.
 */
export function useElectionProgressStream(electionId, { enabled = true, onEvent } = {}) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const handlePayload = useCallback((raw) => {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      setLastEvent(parsed);
      onEventRef.current?.(parsed);
    } catch (err) {
      console.warn('Failed to parse SSE progress event', err);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !electionId) {
      setConnected(false);
      return undefined;
    }

    const controller = new AbortController();
    let buffer = '';

    async function connect() {
      try {
        const response = await fetch(`/api/elections/${electionId}/progress/stream`, {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'text/event-stream' },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`SSE connect failed: ${response.status}`);
        }

        setConnected(true);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const dataLine = part.split('\n').find((line) => line.startsWith('data:'));
            if (dataLine) {
              handlePayload(dataLine.replace(/^data:\s?/, ''));
            }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Election progress stream disconnected', err);
        }
      } finally {
        setConnected(false);
      }
    }

    connect();
    return () => controller.abort();
  }, [electionId, enabled, handlePayload]);

  return { connected, lastEvent };
}

export default useElectionProgressStream;
