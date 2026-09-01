'use client';
import { LockKeyhole } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { User } from '@/lib/types';
import { Button } from '@/components/ui';
export default function LoginPage() {
  const router = useRouter();
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [rememberMatricula, setRememberMatricula] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  function dashboardFor(user: User) {
    return user.role === 'DRIVER'
      ? '/driver/dashboard'
      : user.role === 'SECRETARY' || user.role === 'GOVERNMENT_SECRETARY'
        ? '/secretary/dashboard'
        : '/admin/dashboard';
  }
  useEffect(() => {
    let active = true;
    const stored = localStorage.getItem('user');
    const remembered = localStorage.getItem('rememberedMatricula');
    if (remembered) {
      setMatricula(remembered);
      setRememberMatricula(true);
    }

    if (localStorage.getItem('token') && stored) {
      void api('/auth/me')
        .then(() => {
          if (active) router.replace(dashboardFor(JSON.parse(stored) as User));
        })
        .catch(() => undefined);
    }

    return () => {
      active = false;
    };
  }, [router]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api<{ accessToken: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ matricula, senha }),
      });
      localStorage.setItem('token', result.accessToken);
      localStorage.setItem('user', JSON.stringify(result.user));
      if (rememberMatricula) localStorage.setItem('rememberedMatricula', matricula.trim());
      else localStorage.removeItem('rememberedMatricula');
      router.push(dashboardFor(result.user));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no login');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <form
          onSubmit={submit}
          className="w-full max-w-sm rounded-3xl border border-white/50 bg-white/95 p-7 shadow-2xl backdrop-blur-sm"
        >
          <div className="mb-7 border-b border-slate-200 pb-5 text-center">
            <div className="flex flex-col items-center">
              <img
                src="/branding/municipal-crest.png"
                alt="Brasão municipal"
                className="h-24 w-24 object-contain"
              />
              <p className="mt-3 text-base font-bold text-navy">
                Prefeitura Municipal de Mimoso do Sul
              </p>
              <p className="mt-1 text-xs font-medium uppercase tracking-[.14em] text-slate-500">
                Gestão de Frota
              </p>
            </div>
            <h2 className="mt-6 text-xl font-semibold">Identificação do usuário</h2>
            <p className="mt-1 text-sm text-slate-600">Informe suas credenciais funcionais.</p>
          </div>
          <div>
            <label>Matrícula</label>
            <input
              value={matricula}
              placeholder="Digite sua matrícula"
              onChange={e => setMatricula(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="mt-4">
            <label>Senha</label>
            <div className="relative">
              <input
                type="password"
                value={senha}
                placeholder="Digite sua senha"
                onChange={e => setSenha(e.target.value)}
                autoComplete="current-password"
              />
              <LockKeyhole className="absolute right-3 top-3 text-slate-400" size={18} />
            </div>
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-2 normal-case tracking-normal text-slate-600">
            <input
              type="checkbox"
              checked={rememberMatricula}
              onChange={event => setRememberMatricula(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Lembrar minha matrícula neste dispositivo
          </label>
          {error && (
            <p className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
          )}
          <Button busy={busy} className="mt-6 w-full">
            Entrar
          </Button>
        </form>
      </div>
    </main>
  );
}
