import { redirect } from 'next/navigation';

export default async function BookingRedirectPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string') query.set(key, value);
  }

  redirect(`/book${query.size ? `?${query.toString()}` : ''}`);
}
