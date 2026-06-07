import { z } from 'zod';

const twilioEnvSchema = z.object({
  TWILIO_ACCOUNT_SID: z.string().min(10),
  TWILIO_AUTH_TOKEN: z.string().min(10),
  TWILIO_FROM_NUMBER: z.string().min(8)
});

export type TwilioEnv = z.infer<typeof twilioEnvSchema>;

export function getTwilioEnv(): TwilioEnv {
  return twilioEnvSchema.parse({
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER
  });
}

export async function sendSms(input: { to: string; body: string }) {
  const env = getTwilioEnv();
  const body = new URLSearchParams({
    From: env.TWILIO_FROM_NUMBER,
    To: input.to,
    Body: input.body
  });

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof json?.message === 'string' ? json.message : `Twilio request failed (${response.status}).`;
    throw new Error(message);
  }

  return {
    sid: typeof json?.sid === 'string' ? json.sid : null,
    status: typeof json?.status === 'string' ? json.status : null
  };
}
