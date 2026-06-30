import posthog from 'posthog-js';

const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com';

if (key) {
  posthog.init(key, {
    api_host: host,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    session_recording: {
      maskAllInputs: true,
    },
    persistence: 'localStorage',
  });
}

export function identify(userId: string, props: Record<string, unknown>) {
  if (!key) return;
  posthog.identify(userId, props);
}

export function reset() {
  if (!key) return;
  posthog.reset();
}

export function capture(event: string, props?: Record<string, unknown>) {
  if (!key) return;
  posthog.capture(event, props);
}
