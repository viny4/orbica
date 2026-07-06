import { useEffect, useRef, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { UAParser } from 'ua-parser-js';

declare global {
  interface Window {
    __orbica_analytics_init?: string;
  }
}

export type OrbicaEvent =
  | 'page_view'
  | 'satellite_view'
  | 'rocket_view'
  | 'search'
  | 'login'
  | 'logout';

interface AnalyticsPayload {
  anonymous_user_id: string;
  session_id: string;
  event_type: OrbicaEvent;
  payload?: any;
  path: string;
  referrer: string;
  browser: string;
  os: string;
  device: string;
  screen_resolution: string;
}

// Analytics ingest endpoint. Set NEXT_PUBLIC_ANALYTICS_URL to the deployed API
// (e.g. https://orbica-api.onrender.com) so events are baked into the build.
// In dev only, fall back to the local service. In production we NEVER fall back
// to localhost — otherwise a build missing the env var would make visitors'
// browsers try to reach their own device (triggering a scary local-network
// permission prompt); instead we just skip tracking.
const ANALYTICS_URL =
  process.env.NEXT_PUBLIC_ANALYTICS_URL ||
  (process.env.NODE_ENV !== "production" ? "http://localhost:4001" : "");

const SESSION_KEY = 'orbica_session_id';
const SESSION_EXPIRY_KEY = 'orbica_session_expiry';
const ANON_ID_KEY = 'orbica_anon_id';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function generateUUID(): string {
  return crypto.randomUUID();
}

function getSessionIds() {
  if (typeof window === 'undefined') return { sessionId: '', anonId: '' };

  let anonId = localStorage.getItem(ANON_ID_KEY);
  if (!anonId) {
    anonId = generateUUID();
    localStorage.setItem(ANON_ID_KEY, anonId);
  }

  const now = Date.now();
  let sessionId = localStorage.getItem(SESSION_KEY);
  const sessionExpiry = localStorage.getItem(SESSION_EXPIRY_KEY);

  if (!sessionId || !sessionExpiry || now > parseInt(sessionExpiry, 10)) {
    // Session expired or doesn't exist
    sessionId = generateUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
  }

  // Renew expiry
  localStorage.setItem(SESSION_EXPIRY_KEY, (now + SESSION_TIMEOUT_MS).toString());

  return { sessionId, anonId };
}

export function useAnalytics() {
  const pathname = usePathname();

  const trackEvent = useCallback(
    async (eventType: OrbicaEvent, payload?: any) => {
      if (typeof window === 'undefined') return;
      if (!ANALYTICS_URL) return; // no endpoint configured — skip (never hit localhost in prod)

      try {
        const { sessionId, anonId } = getSessionIds();
        
        const parser = new UAParser();
        const browserObj = parser.getBrowser();
        const osObj = parser.getOS();
        const deviceObj = parser.getDevice();

        const eventData: AnalyticsPayload = {
          anonymous_user_id: anonId,
          session_id: sessionId,
          event_type: eventType,
          payload,
          path: window.location.pathname,
          referrer: document.referrer || '',
          browser: `${browserObj.name || ''} ${browserObj.version || ''}`.trim(),
          os: `${osObj.name || ''} ${osObj.version || ''}`.trim(),
          device: deviceObj.type || 'desktop',
          screen_resolution: `${window.screen.width}x${window.screen.height}`,
        };

        // Send to Go Analytics Service (fire-and-forget; never block the UI).
        await fetch(`${ANALYTICS_URL}/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
          keepalive: true,
        }).catch(() => {
          // Swallow network errors — analytics must never surface to users.
        });
      } catch {
        // Ignore — tracking is best-effort.
      }
    },
    []
  );

  const trackAction = useCallback(
    (eventType: OrbicaEvent, payload?: any) => {
      trackEvent(eventType, payload);
    },
    [trackEvent]
  );

  useEffect(() => {
    // Prevent double tracking in React Strict Mode
    if (window.__orbica_analytics_init === pathname) return;
    window.__orbica_analytics_init = pathname;

    trackEvent('page_view');
  }, [pathname, trackEvent]);

  return { trackAction };
}
