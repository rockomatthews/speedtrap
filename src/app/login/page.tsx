import { LoginClient } from '@/app/login/ui/LoginClient';

export default async function LoginPage({
  searchParams
}: {
  // Next.js 15.5 types `searchParams` as a Promise in generated PageProps.
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const redirectToParam = sp.redirectTo;
  const redirectTo =
    (typeof redirectToParam === 'string' ? redirectToParam : undefined) ?? '/dashboard';

  return <LoginClient redirectTo={redirectTo} />;
}


