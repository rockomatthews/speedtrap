import { NextResponse } from 'next/server';
import { z } from 'zod';

const reservationSchema = z.object({
  email: z.string().trim().email().max(180).transform((value) => value.toLowerCase()),
  requestedAt: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Choose a valid date and time.'),
  message: z.string().trim().min(5).max(3000),
  company: z.string().max(0).optional().default('')
});

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function displayDate(value: string) {
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return `${new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date)} at ${new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC'
  }).format(date)} ET`;
}

export async function POST(request: Request) {
  const parsed = reservationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid reservation request.' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.RESERVATIONS_TO_EMAIL ?? 'reservations@speedtrapracing.com';
  const from = process.env.RESERVATIONS_FROM_EMAIL ?? 'Speed Trap Reservations <reservations@speedtrapracing.com>';
  if (!apiKey) {
    return NextResponse.json({ error: 'Reservation email is being configured. Please call 216-712-4039 for now.' }, { status: 503 });
  }

  const { email, requestedAt, message } = parsed.data;
  const requestedTime = displayDate(requestedAt);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: email,
      subject: `Reservation request for ${requestedTime}`,
      text: `New temporary booking request\n\nEmail: ${email}\nRequested time: ${requestedTime}\n\nMessage:\n${message}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#111">
          <h1 style="margin-bottom:8px">New reservation request</h1>
          <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
          <p><strong>Requested time:</strong> ${escapeHtml(requestedTime)}</p>
          <h2 style="margin-top:28px">Message</h2>
          <p style="white-space:pre-wrap;line-height:1.6">${escapeHtml(message)}</p>
        </div>
      `
    })
  });

  const result = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
  if (!response.ok) {
    console.error('Reservation email failed', { status: response.status, message: result?.message });
    return NextResponse.json(
      { error: 'We could not send your request. Please call 216-712-4039 for assistance.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, id: result?.id ?? null });
}
