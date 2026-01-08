import { LoginClient } from '@/app/login/ui/LoginClient';

export default function LoginPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const redirectToParam = searchParams?.redirectTo;
  const redirectTo =
    (typeof redirectToParam === 'string' ? redirectToParam : undefined) ?? '/dashboard';

  return <LoginClient redirectTo={redirectTo} />;
}


