import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(2000)
});

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(12)
});

const siteContext = `
Speed Trap Racing is an advanced sim racing center, restaurant, and bar in Lakewood, Ohio.
Address: 14718 Detroit Ave. Lakewood, OH 44107.
Phone: 216-712-4039.
Primary site pages:
- /pricing: solo race pricing, party pricing, monthly membership, private events.
- /book: online race booking.
- /leaderboards: VMS hotlap leaderboards.
- /leagues: league information and registration.
- /menu: food menu.
- /race-radar: Race Radar blog.
- /merch: merchandise.
- /dashboard: Driver Portal for logged-in customers.
- /login: sign in or create account.
Current race products include 15-minute and 30-minute sessions, group/party pod packages, and a monthly membership.
Private event inquiries go through the private events area on /pricing or email events@speedtrapracing.com.
Answer as a concise Speed Trap site concierge. Help users find the right page, explain the site flow, and avoid inventing policies, availability, or prices that are not listed here.
When the user needs a page, include the path in plain text.
`;

function fallbackReply(userText: string) {
  const text = userText.toLowerCase();
  if (text.includes('book') || text.includes('reserve') || text.includes('schedule')) {
    return 'For race reservations, go to /book. For private events or larger groups, use the private events section on /pricing or email events@speedtrapracing.com.';
  }
  if (text.includes('price') || text.includes('cost') || text.includes('membership') || text.includes('member')) {
    return 'Pricing, party packages, and membership details are on /pricing.';
  }
  if (text.includes('leader') || text.includes('lap') || text.includes('time') || text.includes('score')) {
    return 'Live challenge standings are on /leaderboards. Your own driver info appears in /dashboard after you sign in.';
  }
  if (text.includes('menu') || text.includes('food') || text.includes('drink')) {
    return 'The food menu is on /menu.';
  }
  if (text.includes('league') || text.includes('team')) {
    return 'League information and registration live on /leagues.';
  }
  if (text.includes('where') || text.includes('address') || text.includes('phone')) {
    return 'Speed Trap Racing is at 14718 Detroit Ave. Lakewood, OH 44107. Phone: 216-712-4039.';
  }
  return 'I can help with booking, pricing, memberships, leaderboards, leagues, the menu, Race Radar, merch, or private events. The fastest starting points are /pricing, /book, and /leaderboards.';
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid chat request.' }, { status: 400 });
  }

  const messages = parsed.data.messages.slice(-10);
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ reply: fallbackReply(lastUserMessage), configured: false });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
        temperature: 0.25,
        max_tokens: 420,
        messages: [
          { role: 'system', content: siteContext },
          ...messages.map((message) => ({ role: message.role, content: message.content }))
        ]
      })
    });

    if (!response.ok) {
      console.error('OpenAI chat request failed', await response.text());
      return NextResponse.json({ reply: fallbackReply(lastUserMessage), configured: false });
    }

    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const reply = json.choices?.[0]?.message?.content?.trim();

    return NextResponse.json({ reply: reply || fallbackReply(lastUserMessage), configured: true });
  } catch (error) {
    console.error('Speed Trap assistant failed', error);
    return NextResponse.json({ reply: fallbackReply(lastUserMessage), configured: false });
  }
}
