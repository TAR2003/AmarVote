import { useCallback, useEffect, useRef, useState } from 'react';

const INITIAL_RETRY_MS = 1000;
const MAX_RETRY_MS = 30000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function redirectToLogin() {
  localStorage.removeItem('email');
  localStorage.setItem('logout', Date.now());
  window.location.href = '/otp-login';
}

/**
 * Subscribe to election worker progress via Server-Sent Events (cookie auth).
 * Events include embedded status snapshots — no polling required.
 * Auto-reconnects with exponential backoff unless auth fails (401/403).
 */
export function useElectionProgressStream(electionId, { enabled = true, onEvent } = {}) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [authError, setAuthError] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const handlePayload = useCallback((raw) => {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!parsed || parsed.eventType === 'heartbeat') {
        return;
      }
      setLastEvent(parsed);
      onEventRef.current?.(parsed);
    } catch (err) {
      console.warn('Failed to parse SSE progress event', err);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !electionId || authError) {
      setConnected(false);
      return undefined;
    }

    let cancelled = false;
    let retryMs = INITIAL_RETRY_MS;
    let activeController = null;

    async function readStream(response, signal) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!cancelled && !signal.aborted) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (part.startsWith(':')) {
            continue;
          }
          const dataLine = part.split('\n').find((line) => line.startsWith('data:'));
          if (dataLine) {
            handlePayload(dataLine.replace(/^data:\s?/, ''));
          }
        }
      }
    }

    async function connectLoop() {
      while (!cancelled) {
        activeController = new AbortController();

        try {
          const response = await fetch(`/api/elections/${electionId}/progress/stream`, {
            method: 'GET',
            credentials: 'include',
            headers: { Accept: 'text/event-stream' },
            signal: activeController.signal,
          });

          if (response.status === 401 || response.status === 403) {
            console.warn(`SSE auth failed (${response.status}) — login required`);
            setAuthError(true);
            redirectToLogin();
            return;
          }

          if (!response.ok || !response.body) {
            throw new Error(`SSE connect failed: ${response.status}`);
          }

          setConnected(true);
          retryMs = INITIAL_RETRY_MS;
          await readStream(response, activeController.signal);
        } catch (err) {
          if (err.name !== 'AbortError' && !cancelled) {
            console.warn('Election progress stream disconnected', err);
          }
        } finally {
          setConnected(false);
        }

        if (cancelled || authError) {
          break;
        }

        await sleep(retryMs);
        retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
      }
    }

    connectLoop();

    return () => {
      cancelled = true;
      activeController?.abort();
      setConnected(false);
    };
  }, [electionId, enabled, authError, handlePayload]);

  return { connected, lastEvent, authError };
}

export default useElectionProgressStream;
