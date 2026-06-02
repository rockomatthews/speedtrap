import crypto from 'node:crypto';

import { env } from '@/lib/supabase/env';

export type ToastWebhookPayload = {
  timestamp?: string;
  eventCategory?: string;
  eventType?: string;
  guid?: string;
  details?: {
    restaurantGuid?: string;
    order?: ToastOrder;
    [key: string]: unknown;
  };
};

export type ToastOrder = {
  guid?: string;
  paidDate?: string | null;
  openedDate?: string | null;
  promisedDate?: string | null;
  estimatedFulfillmentDate?: string | null;
  voided?: boolean;
  deleted?: boolean;
  tabName?: string | null;
  checks?: ToastCheck[];
  [key: string]: unknown;
};

type ToastCheck = {
  guid?: string;
  paidDate?: string | null;
  paymentStatus?: string | null;
  voided?: boolean;
  deleted?: boolean;
  customer?: Record<string, unknown> | null;
  payments?: Array<Record<string, unknown>>;
  selections?: ToastSelection[];
  [key: string]: unknown;
};

type ToastSelection = {
  guid?: string;
  quantity?: number;
  voided?: boolean;
  deferred?: boolean;
  item?: { guid?: string } | null;
  menuItem?: { guid?: string } | null;
  itemGroup?: { guid?: string } | null;
  menuGroup?: { guid?: string } | null;
  salesCategory?: { guid?: string } | null;
  modifiers?: ToastSelection[];
  selections?: ToastSelection[];
  childSelections?: ToastSelection[];
  [key: string]: unknown;
};

export type ToastSessionMatch = {
  matched: boolean;
  quantity: number;
  reason?: string;
  checkGuid?: string | null;
  paymentGuid?: string | null;
};

function csvSet(value?: string) {
  return new Set(
    (value ?? '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function stringifyPart(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function guidFrom(value: unknown) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'guid' in value) return stringifyPart((value as { guid?: unknown }).guid);
  return null;
}

function selectionGuids(selection: ToastSelection) {
  return [
    guidFrom(selection.item),
    guidFrom(selection.menuItem),
    stringifyPart(selection.itemGuid),
    stringifyPart(selection.menuItemGuid),
    guidFrom(selection.itemGroup),
    guidFrom(selection.menuGroup),
    guidFrom(selection.salesCategory),
    stringifyPart(selection.itemGroupGuid),
    stringifyPart(selection.menuGroupGuid),
    stringifyPart(selection.salesCategoryGuid)
  ]
    .filter(Boolean)
    .map((guid) => String(guid).toLowerCase());
}

function flattenSelections(selections: ToastSelection[] | undefined): ToastSelection[] {
  const out: ToastSelection[] = [];
  for (const selection of selections ?? []) {
    out.push(selection);
    out.push(...flattenSelections(selection.modifiers));
    out.push(...flattenSelections(selection.selections));
    out.push(...flattenSelections(selection.childSelections));
  }
  return out;
}

function findEmail(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  if ('email' in value && typeof (value as { email?: unknown }).email === 'string') {
    const email = (value as { email: string }).email.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return email;
  }
  for (const nested of Object.values(value as Record<string, unknown>)) {
    const found = findEmail(nested);
    if (found) return found;
  }
  return null;
}

function findName(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const firstName = stringifyPart(record.firstName ?? record.first_name);
  const lastName = stringifyPart(record.lastName ?? record.last_name);
  const combined = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (combined.length >= 3) return combined;

  for (const key of ['name', 'fullName', 'full_name', 'tabName']) {
    const candidate = stringifyPart(record[key]);
    if (candidate && candidate.length >= 3) return candidate;
  }

  for (const nested of Object.values(record)) {
    const found = findName(nested);
    if (found) return found;
  }
  return null;
}

export function verifyToastSignature(rawBody: string, timestamp: string, signature: string, secret: string) {
  const expected = crypto.createHmac('sha256', secret).update(`${rawBody}${timestamp}`, 'utf8').digest('base64');
  return timingSafeEqual(expected, signature);
}

export function toastConfig() {
  return {
    webhookSecret: env.TOAST_WEBHOOK_SECRET,
    restaurantGuid: env.TOAST_RESTAURANT_GUID,
    racingItemGuids: csvSet(env.TOAST_RACING_ITEM_GUIDS),
    racingCategoryGuids: csvSet(env.TOAST_RACING_CATEGORY_GUIDS),
    sessionMinutes: env.TOAST_DEFAULT_SESSION_MINUTES ?? 30,
    sessionPods: env.TOAST_DEFAULT_SESSION_PODS ?? 1
  };
}

export function isToastOrderEvent(payload: ToastWebhookPayload) {
  return payload.eventType === 'order_updated' || payload.eventType === 'channel_order_updated';
}

export function isPaidOrder(order: ToastOrder) {
  if (order.voided || order.deleted) return false;
  if (order.paidDate) return true;
  return (order.checks ?? []).some((check) => {
    if (check.voided || check.deleted) return false;
    const status = String(check.paymentStatus ?? '').toUpperCase();
    return Boolean(check.paidDate || status === 'PAID' || status === 'CLOSED' || (check.payments ?? []).length > 0);
  });
}

export function matchRacingSession(order: ToastOrder): ToastSessionMatch {
  const { racingItemGuids, racingCategoryGuids } = toastConfig();
  if (racingItemGuids.size === 0 && racingCategoryGuids.size === 0) {
    return { matched: false, quantity: 0, reason: 'Toast racing item/category GUIDs are not configured.' };
  }

  let quantity = 0;
  let checkGuid: string | null = null;
  let paymentGuid: string | null = null;

  for (const check of order.checks ?? []) {
    const selections = flattenSelections(check.selections);
    for (const selection of selections) {
      if (selection.voided) continue;
      const guids = selectionGuids(selection);
      const itemMatch = guids.some((guid) => racingItemGuids.has(guid));
      const categoryMatch = guids.some((guid) => racingCategoryGuids.has(guid));
      if (!itemMatch && !categoryMatch) continue;
      quantity += Math.max(1, Number(selection.quantity ?? 1) || 1);
      checkGuid ??= check.guid ?? null;
      paymentGuid ??= (check.payments ?? []).map((payment) => stringifyPart(payment.guid)).find(Boolean) ?? null;
    }
  }

  return quantity > 0
    ? { matched: true, quantity, checkGuid, paymentGuid }
    : { matched: false, quantity: 0, reason: 'Toast order does not contain a configured racing-session item.' };
}

export function extractGuest(order: ToastOrder) {
  const email = findEmail(order);
  const name = findName(order) ?? (email ? email.split('@')[0]?.replace(/[._-]+/g, ' ') : null);
  return {
    email,
    name: name && name.trim().length >= 3 ? name.trim() : null
  };
}

export function localVenueDateTime(input: string | Date, minutesToAdd = 0) {
  const date = typeof input === 'string' ? new Date(input) : input;
  const adjusted = new Date(date.getTime() + minutesToAdd * 60_000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: env.VMS_VENUE_TIMEZONE ?? 'America/Denver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(adjusted);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day} ${value.hour}:${value.minute}:${value.second}`;
}

export function sessionStartSource(payload: ToastWebhookPayload, order: ToastOrder) {
  return (
    stringifyPart(order.promisedDate) ??
    stringifyPart(order.estimatedFulfillmentDate) ??
    stringifyPart(order.paidDate) ??
    (order.checks ?? []).map((check) => stringifyPart(check.paidDate)).find(Boolean) ??
    stringifyPart(payload.timestamp) ??
    new Date().toISOString()
  );
}
