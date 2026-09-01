'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/';
  const [authorized, setAuthorized] = useState(isLogin);

  useEffect(() => {
    if (isLogin) {
      setAuthorized(true);
      return;
    }

    const hasSession = localStorage.getItem('token') && localStorage.getItem('user');
    if (!hasSession) {
      setAuthorized(false);
      router.replace('/');
      return;
    }

    setAuthorized(true);
  }, [isLogin, pathname, router]);

  if (!authorized) return null;
  return children;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 20_000 } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <AuthGate>{children}</AuthGate>
    </QueryClientProvider>
  );
}
