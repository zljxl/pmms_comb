'use client';

import {
  ArrowLeft,
  BarChart3,
  BusFront,
  ClipboardList,
  FileBarChart,
  Fuel,
  LogOut,
  MapPin,
  Menu,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { User } from '@/lib/types';

export function DashboardDetailLayout({
  base,
  back,
  title,
  subtitle,
  children,
}: {
  base: string;
  back: string;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
  }, []);

  function logout() {
    const rememberedMatricula = localStorage.getItem('rememberedMatricula');
    localStorage.clear();
    if (rememberedMatricula) localStorage.setItem('rememberedMatricula', rememberedMatricula);
    router.replace('/');
  }

  if (!user)
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100">
        <div className="flex flex-col items-center gap-4">
          <img
            src="/branding/municipal-crest.png"
            alt="Brasão municipal"
            className="h-20 w-20 object-contain"
          />
          <p className="text-sm font-medium text-slate-600">Carregando...</p>
        </div>
      </main>
    );

  const driver = user.role === 'DRIVER';
  const section = back.split('/').at(-1);
  const displayTitle =
    title ||
    (
      {
        abastecimentos: 'Detalhes do abastecimento',
        veiculos: 'Detalhes do veículo',
        motoristas: 'Detalhes do motorista',
        usuarios: 'Detalhes do usuário',
        secretarias: 'Detalhes da secretaria',
      } as Record<string, string>
    )[section || ''] ||
    'Detalhes';
  const items = driver
    ? [
        { href: base, label: 'Início', icon: BarChart3 },
        { href: `${base}/postos`, label: 'Postos próximos', icon: MapPin },
        { href: `${base}/abastecimentos`, label: 'Meus abastecimentos', icon: Fuel },
      ]
    : [
        { href: base, label: 'Visão geral', icon: BarChart3 },
        { href: `${base}/abastecimentos`, label: 'Abastecimentos', icon: Fuel },
        { href: `${base}/veiculos`, label: 'Veículos', icon: BusFront },
        { href: `${base}/motoristas`, label: 'Motoristas', icon: Users },
        ...(['ADMIN', 'MAYOR', 'GOVERNMENT_SECRETARY'].includes(user.role)
          ? [{ href: `${base}/usuarios`, label: 'Usuários', icon: Users }]
          : []),
        { href: `${base}/secretarias`, label: 'Secretarias', icon: ClipboardList },
        { href: `${base}/postos`, label: 'Postos', icon: MapPin },
        { href: `${base}/quotas`, label: 'Quotas', icon: WalletCards },
        { href: `${base}/relatorios`, label: 'Relatórios', icon: FileBarChart },
      ];

  return (
    <div className="min-h-screen md:grid md:grid-cols-[250px_1fr]">
      {menu && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-20 bg-navy/50 md:hidden"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        id="dashboard-sidebar"
        aria-label="Menu principal"
        className={`fixed inset-y-0 left-0 z-30 flex w-[250px] flex-col border-r border-slate-700 bg-navy text-white shadow-2xl transition-transform md:static md:translate-x-0 md:shadow-none ${menu ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-700 px-5">
          <div className="flex items-center gap-3">
            <img
              src="/branding/municipal-crest.png"
              alt="Brasão municipal"
              className="h-10 w-10 object-contain"
            />
            <div>
              <p className="text-sm font-semibold">Gestão de Frota</p>
              <p className="text-[11px] text-slate-400">Prefeitura Municipal</p>
            </div>
          </div>
          <button
            type="button"
            className="p-1 hover:bg-white/10 md:hidden"
            onClick={() => setMenu(false)}
            aria-label="Fechar menu"
          >
            <X />
          </button>
        </div>
        <nav className="py-4">
          {items.map(({ href, label, icon: Icon }) => {
            const active = href !== base && pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenu(false)}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full items-center gap-3 border-l-4 px-5 py-3 text-left text-sm transition-colors ${active ? 'border-slate-100 bg-slate-700/60 font-semibold text-white' : 'border-transparent text-slate-300 hover:bg-slate-800 hover:text-white'}`}
              >
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-slate-700 p-4">
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2 px-1 py-2 text-sm text-slate-300 hover:text-white"
          >
            <LogOut size={17} />
            Sair do sistema
          </button>
        </div>
      </aside>
      <main className="min-w-0">
        <header className="flex min-h-20 items-center justify-between border-b border-slate-300 bg-white px-5 py-3 md:px-8">
          <button
            type="button"
            aria-label="Abrir menu"
            aria-controls="dashboard-sidebar"
            aria-expanded={menu}
            className="rounded p-2 hover:bg-slate-100 md:hidden"
            onClick={() => setMenu(true)}
          >
            <Menu />
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">
              {driver ? 'Área do motorista' : 'Painel administrativo'}
            </p>
            <p className="text-sm font-semibold">{user.nome}</p>
            {user.secretaria && (
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                Secretaria em uso: {user.secretaria.nome}
                {user.secretaria.sigla ? ` (${user.secretaria.sigla})` : ''}
              </p>
            )}
          </div>
          <div className="grid h-9 w-9 place-items-center rounded bg-navy text-sm font-bold text-white">
            {user.nome[0]}
          </div>
        </header>
        <div className="mx-auto max-w-7xl p-5 md:p-8">
          <div className="no-print mb-6 flex flex-col justify-between gap-1 border-b border-slate-300 pb-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs text-slate-500">
                Sistema Municipal de Controle de Combustíveis
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{displayTitle}</h1>
              {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
            </div>
            <p className="text-xs capitalize text-slate-500">
              {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date())}
            </p>
          </div>
          <Link
            href={back}
            className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-navy"
          >
            <ArrowLeft size={17} />
            Voltar
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
