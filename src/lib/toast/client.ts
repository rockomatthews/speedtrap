import { env } from '@/lib/supabase/env';
import { type ToastOrder } from '@/lib/toast/webhook';

type ToastAuthResponse = {
  token?: {
    accessToken?: string;
    tokenType?: string;
    expiresIn?: number;
  };
  accessToken?: string;
  tokenType?: string;
};

function baseUrl() {
  return (env.TOAST_API_BASE_URL ?? 'https://ws-api.toasttab.com').replace(/\/$/, '');
}

export function hasToastApiCredentials() {
  return Boolean(env.TOAST_CLIENT_ID && env.TOAST_CLIENT_SECRET && env.TOAST_RESTAURANT_GUID);
}

async function getToastAccessToken() {
  if (!env.TOAST_CLIENT_ID || !env.TOAST_CLIENT_SECRET) return null;

  const res = await fetch(`${baseUrl()}/authentication/v1/authentication/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: env.TOAST_CLIENT_ID,
      clientSecret: env.TOAST_CLIENT_SECRET,
      userAccessType: 'TOAST_MACHINE_CLIENT'
    }),
    cache: 'no-store'
  });

  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as ToastAuthResponse | null;
  return json?.token?.accessToken ?? json?.accessToken ?? null;
}

export async function fetchToastOrder(orderGuid: string): Promise<ToastOrder | null> {
  if (!env.TOAST_RESTAURANT_GUID) return null;
  const token = await getToastAccessToken();
  if (!token) return null;

  const res = await fetch(`${baseUrl()}/orders/v2/orders/${encodeURIComponent(orderGuid)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Toast-Restaurant-External-ID': env.TOAST_RESTAURANT_GUID
    },
    cache: 'no-store'
  });

  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as ToastOrder | null;
}
