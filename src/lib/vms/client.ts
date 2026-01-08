import { env } from '@/lib/supabase/env';

export class VmsError extends Error {
  status: number;
  body?: string;
  constructor(message: string, status: number, body?: string) {
    super(message);
    this.name = 'VmsError';
    this.status = status;
    this.body = body;
  }
}

export type VmsClientOptions = {
  timezoneOffsetHours?: number;
};

export class VmsClient {
  private baseUrl = 'https://api.simracing.co.uk/v0.1';
  private apiKey: string;
  private timezoneOffsetHours?: number;

  constructor(apiKey: string, opts?: VmsClientOptions) {
    this.apiKey = apiKey;
    this.timezoneOffsetHours = opts?.timezoneOffsetHours;
  }

  static fromEnv(opts?: VmsClientOptions) {
    if (!env.VMS_API_KEY) throw new Error('Missing VMS_API_KEY');
    return new VmsClient(env.VMS_API_KEY, opts);
  }

  async request(path: string, init?: RequestInit) {
    const url = `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `SRL ${this.apiKey}`);

    // For endpoints that support past/future logic, docs recommend providing timezone-offset.
    if (this.timezoneOffsetHours !== undefined) {
      headers.set('timezone-offset', String(this.timezoneOffsetHours));
    }

    const res = await fetch(url, {
      ...init,
      headers,
      // Avoid caching user-specific API responses
      cache: 'no-store'
    });

    const body = await res.text();

    if (!res.ok) {
      throw new VmsError(`VMS request failed (${res.status})`, res.status, body);
    }

    return body;
  }
}


