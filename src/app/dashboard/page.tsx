'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  BusFront,
  ClipboardList,
  Droplets,
  FileBarChart,
  Fuel,
  Gauge,
  LogOut,
  MapPin,
  Menu,
  Plus,
  Printer,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, money, number, uploadImage } from '@/lib/api';
import { statusLabel as statusName } from '@/lib/status';
import {
  Dashboard,
  Driver,
  DriversData,
  GasStation,
  QuotasData,
  Secretaria,
  Session,
  User,
  UserRecord,
  Vehicle,
} from '@/lib/types';
import { Badge, Button, Card } from '@/components/ui';
import { LocationPicker } from '@/components/location-picker';
import { TablePagination, useTablePagination } from '@/components/table-pagination';

type Section =
  | 'overview'
  | 'refuelings'
  | 'vehicles'
  | 'drivers'
  | 'users'
  | 'secretarias'
  | 'stations'
  | 'quotas'
  | 'reports';
const sectionSlugs: Record<Section, string> = {
  overview: '',
  refuelings: 'abastecimentos',
  vehicles: 'veiculos',
  drivers: 'motoristas',
  users: 'usuarios',
  secretarias: 'secretarias',
  stations: 'postos',
  quotas: 'quotas',
  reports: 'relatorios',
};
const slugSections: Record<string, Section> = Object.fromEntries(
  Object.entries(sectionSlugs).map(([section, slug]) => [slug, section]),
) as Record<string, Section>;
const sectionTitles: Record<Section, string> = {
  overview: 'Painel da frota',
  refuelings: 'Abastecimentos',
  vehicles: 'Veículos',
  drivers: 'Motoristas',
  users: 'Usuários',
  secretarias: 'Secretarias',
  stations: 'Postos credenciados',
  quotas: 'Quotas mensais',
  reports: 'Relatórios',
};
type Refueling = {
  id: number;
  uid: string | null;
  externalCode: string | null;
  createdAt: string;
  liters: number;
  totalAmount: number;
  fuelType: string;
  fuelStation: string | null;
  status: string;
  vehicle: { placa: string; marca: string; modelo: string };
  user: { nome: string };
  secretaria: { nome: string; sigla?: string | null };
};
function useUser() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    const value = localStorage.getItem('user');
    if (value) setUser(JSON.parse(value));
  }, []);
  return user;
}
export default function DashboardPage() {
  const router = useRouter(),
    pathname = usePathname(),
    params = useParams<{ section?: string }>(),
    user = useUser(),
    client = useQueryClient();
  const [menu, setMenu] = useState(false),
    [driverVehicleId, setDriverVehicleId] = useState(0),
    [modal, setModal] = useState<
      | 'start'
      | 'fuel'
      | 'finish'
      | 'driver'
      | 'vehicle'
      | 'secretaria'
      | 'station'
      | 'quota'
      | 'user'
      | null
    >(null);
  const active = slugSections[params.section ?? ''] ?? 'overview';
  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<Dashboard>('/dashboard'),
  });
  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => api<Session | null>('/vehicle-sessions/current'),
    enabled: user?.role === 'DRIVER',
  });
  const vehicles = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => api<Vehicle[]>('/vehicles'),
    enabled: !!user,
  });
  const availableVehicles = useQuery({
    queryKey: ['available-vehicles'],
    queryFn: () => api<Vehicle[]>('/vehicles/available'),
    enabled: user?.role === 'DRIVER' && !session.data,
  });
  const refuelings = useQuery({
    queryKey: ['refuelings'],
    queryFn: () => api<Refueling[]>('/refuelings'),
    enabled: !!user,
  });
  const stations = useQuery({
    queryKey: ['stations'],
    queryFn: () => api<GasStation[]>('/stations'),
    enabled: !!user,
  });
  const drivers = useQuery({
    queryKey: ['drivers'],
    queryFn: () => api<DriversData>('/drivers'),
    enabled: !!user && user.role !== 'DRIVER',
  });
  const users = useQuery({
    queryKey: ['users'],
    queryFn: () => api<UserRecord[]>('/users'),
    enabled:
      user?.role === 'ADMIN' || user?.role === 'MAYOR' || user?.role === 'GOVERNMENT_SECRETARY',
  });
  const secretarias = useQuery({
    queryKey: ['secretarias'],
    queryFn: () => api<Secretaria[]>('/secretarias'),
    enabled: !!user && user.role !== 'DRIVER',
  });
  const quotas = useQuery({
    queryKey: ['quotas'],
    queryFn: () => api<QuotasData>('/quotas'),
    enabled: !!user && user.role !== 'DRIVER',
  });
  const dashboardBase =
    user?.role === 'DRIVER'
      ? '/driver/dashboard'
      : user?.role === 'SECRETARY' || user?.role === 'GOVERNMENT_SECRETARY'
        ? '/secretary/dashboard'
        : '/admin/dashboard';
  useEffect(() => {
    if (!user) return;
    const rolePrefix = pathname.split('/')[1];
    const expectedPrefix = dashboardBase.split('/')[1];
    if (rolePrefix !== expectedPrefix)
      router.replace(`${dashboardBase}${sectionSlugs[active] ? `/${sectionSlugs[active]}` : ''}`);
  }, [active, dashboardBase, pathname, router, user]);
  useEffect(() => {
    if (!menu) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(false);
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [menu]);
  function navigate(section: Section) {
    setMenu(false);
    router.push(
      sectionSlugs[section] ? `${dashboardBase}/${sectionSlugs[section]}` : dashboardBase,
    );
  }
  function logout() {
    const rememberedMatricula = localStorage.getItem('rememberedMatricula');
    localStorage.clear();
    if (rememberedMatricula) localStorage.setItem('rememberedMatricula', rememberedMatricula);
    router.replace('/');
  }
  function refreshed() {
    setModal(null);
    void client.invalidateQueries();
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
  const navigation = driver
    ? [
        { id: 'overview' as const, label: 'Início', icon: BarChart3 },
        { id: 'stations' as const, label: 'Postos próximos', icon: MapPin },
        { id: 'refuelings' as const, label: 'Meus abastecimentos', icon: Fuel },
      ]
    : [
        { id: 'overview' as const, label: 'Visão geral', icon: BarChart3 },
        { id: 'refuelings' as const, label: 'Abastecimentos', icon: Fuel },
        { id: 'vehicles' as const, label: 'Veículos', icon: BusFront },
        { id: 'drivers' as const, label: 'Motoristas', icon: Users },
        ...(['ADMIN', 'MAYOR', 'GOVERNMENT_SECRETARY'].includes(user.role)
          ? [{ id: 'users' as const, label: 'Usuários', icon: Users }]
          : []),
        { id: 'secretarias' as const, label: 'Secretarias', icon: ClipboardList },
        { id: 'stations' as const, label: 'Postos', icon: MapPin },
        { id: 'quotas' as const, label: 'Quotas', icon: WalletCards },
        { id: 'reports' as const, label: 'Relatórios', icon: FileBarChart },
      ];
  return (
    <div className="h-dvh overflow-hidden md:grid md:grid-cols-[250px_1fr]">
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
        className={`fixed inset-y-0 left-0 z-30 flex h-dvh w-[250px] flex-col overflow-hidden border-r border-slate-700 bg-navy text-white shadow-2xl transition-transform md:static md:translate-x-0 md:shadow-none ${menu ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-700 px-5">
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
            aria-label="Fechar menu"
            onClick={() => setMenu(false)}
            className="p-1 hover:bg-white/10 md:hidden"
          >
            <X />
          </button>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto py-4">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              onClick={() => navigate(id)}
              aria-current={active === id ? 'page' : undefined}
              className={`flex w-full items-center gap-3 border-l-4 px-5 py-3 text-left text-sm transition-colors ${active === id ? 'border-slate-100 bg-slate-700/60 font-semibold text-white' : 'border-transparent text-slate-300 hover:bg-slate-800 hover:text-white'}`}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
        <div className="shrink-0 border-t border-slate-700 p-4">
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
      <main className="flex h-dvh min-w-0 flex-col overflow-hidden">
        <header className="flex min-h-20 shrink-0 items-center justify-between border-b border-slate-300 bg-white px-5 py-3 md:px-8">
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
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-5 md:p-8">
            <div className="no-print mb-6 flex flex-col justify-between gap-1 border-b border-slate-300 pb-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs text-slate-500">
                  Sistema Municipal de Controle de Combustíveis
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                  {sectionTitles[active]}
                </h1>
              </div>
              <p className="text-xs capitalize text-slate-500">
                {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date())}
              </p>
            </div>
            {active === 'overview' &&
              (driver ? (
                <DriverPanel
                  session={session.data}
                  vehicles={vehicles.data ?? []}
                  selectedVehicleId={driverVehicleId}
                  selectVehicle={setDriverVehicleId}
                  loading={session.isLoading || vehicles.isLoading}
                  open={setModal}
                />
              ) : (
                <AdminPanel data={dashboard.data} loading={dashboard.isLoading} />
              ))}
            {active === 'vehicles' && (
              <VehiclesSection
                vehicles={vehicles.data ?? []}
                loading={vehicles.isLoading}
                session={session.data}
                driver={driver}
                canCreate={!driver && user.role !== 'MAYOR'}
                canAssign={user.role === 'SECRETARY'}
                detailBase={dashboardBase}
                open={setModal}
              />
            )}
            {active === 'refuelings' && (
              <RefuelingsSection
                items={refuelings.data ?? []}
                loading={refuelings.isLoading}
                detailBase={dashboardBase}
                canCreate={!driver}
                open={() => setModal('fuel')}
              />
            )}
            {active === 'drivers' && (
              <DriversSection
                data={drivers.data}
                loading={drivers.isLoading}
                detailBase={dashboardBase}
                open={() => setModal('driver')}
              />
            )}
            {active === 'users' && (
              <UsersSection
                items={users.data ?? []}
                loading={users.isLoading}
                detailBase={dashboardBase}
                canCreate={user.role === 'ADMIN'}
                open={() => setModal('user')}
              />
            )}
            {active === 'secretarias' && (
              <SecretariasSection
                items={secretarias.data ?? []}
                loading={secretarias.isLoading}
                canCreate={user.role === 'ADMIN'}
                detailBase={dashboardBase}
                open={() => setModal('secretaria')}
              />
            )}
            {active === 'stations' && (
              <StationsSection
                items={stations.data ?? []}
                loading={stations.isLoading}
                canCreate={['ADMIN', 'MAYOR', 'GOVERNMENT_SECRETARY'].includes(user.role)}
                detailBase={dashboardBase}
                showDetails={!driver}
                open={() => setModal('station')}
              />
            )}
            {active === 'quotas' && (
              <QuotasSection
                data={quotas.data}
                loading={quotas.isLoading}
                detailBase={dashboardBase}
                open={() => setModal('quota')}
              />
            )}
            {active === 'reports' && (
              <ReportsSection items={refuelings.data ?? []} loading={refuelings.isLoading} />
            )}
          </div>
        </div>
      </main>
      {modal === 'start' && (
        <StartModal
          vehicles={
            driver
              ? (availableVehicles.data ?? [])
              : (vehicles.data ?? []).filter(item => item.status === 'AVAILABLE')
          }
          drivers={drivers.data?.drivers ?? []}
          user={user}
          close={() => setModal(null)}
          done={refreshed}
        />
      )}{' '}
      {modal === 'fuel' && driver && vehicles.data?.find(item => item.id === driverVehicleId) && (
        <FuelModal
          vehicle={vehicles.data.find(item => item.id === driverVehicleId)!}
          driverId={user.id}
          driverName={user.nome}
          sessionId={session.data?.vehicle.id === driverVehicleId ? session.data.id : undefined}
          stations={stations.data ?? []}
          close={() => setModal(null)}
          done={refreshed}
        />
      )}{' '}
      {modal === 'fuel' && !driver && (
        <RefuelingTargetModal
          drivers={drivers.data?.drivers ?? []}
          vehicles={vehicles.data ?? []}
          sessions={dashboard.data?.activeSessions ?? []}
          stations={stations.data ?? []}
          allowRetroactive={user.role === 'SECRETARY'}
          close={() => setModal(null)}
          done={refreshed}
        />
      )}{' '}
      {modal === 'finish' && session.data && (
        <FinishModal session={session.data} close={() => setModal(null)} done={refreshed} />
      )}{' '}
      {modal === 'driver' && drivers.data && (
        <DriverModal
          data={drivers.data}
          user={user}
          close={() => setModal(null)}
          done={refreshed}
        />
      )}{' '}
      {modal === 'user' && <UserModal close={() => setModal(null)} done={refreshed} />}{' '}
      {modal === 'vehicle' && (
        <VehicleModal
          secretarias={secretarias.data ?? []}
          user={user}
          close={() => setModal(null)}
          done={refreshed}
        />
      )}{' '}
      {modal === 'secretaria' && (
        <SecretariaModal users={users.data ?? []} close={() => setModal(null)} done={refreshed} />
      )}{' '}
      {modal === 'station' && <StationModal close={() => setModal(null)} done={refreshed} />}{' '}
      {modal === 'quota' && quotas.data && (
        <QuotaModal data={quotas.data} close={() => setModal(null)} done={refreshed} />
      )}{' '}
    </div>
  );
}

function DriverPanel({
  session,
  vehicles,
  selectedVehicleId,
  selectVehicle,
  loading,
  open,
}: {
  session: Session | null | undefined;
  vehicles: Vehicle[];
  selectedVehicleId: number;
  selectVehicle: (id: number) => void;
  loading: boolean;
  open: (m: 'fuel' | 'finish') => void;
}) {
  const [plateQuery, setPlateQuery] = useState('');
  if (loading) return <Card>Carregando dados do veículo...</Card>;
  const selected = vehicles.find(item => item.id === selectedVehicleId);
  return (
    <>
      <Card>
        <h2 className="text-base font-semibold">Registrar abastecimento</h2>
        <p className="mt-1 text-sm text-slate-500">
          Localize o veículo pela placa e siga diretamente para o lançamento.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label>Placa do veículo</label>
            <input
              list="driver-dashboard-vehicle-plates"
              value={plateQuery}
              onChange={event => {
                const value = event.target.value.toUpperCase();
                const normalized = value.replace(/[^A-Z0-9]/g, '');
                const match = vehicles.find(
                  item => item.placa.replace(/[^A-Z0-9]/gi, '').toUpperCase() === normalized,
                );
                setPlateQuery(value);
                selectVehicle(match?.id ?? 0);
              }}
              placeholder="Digite a placa"
            />
            <datalist id="driver-dashboard-vehicle-plates">
              {vehicles.map(item => (
                <option key={item.id} value={item.placa}>
                  {item.placa} · {item.marca} {item.modelo}
                </option>
              ))}
            </datalist>
          </div>
          <Button onClick={() => open('fuel')} disabled={!selected}>
            <Fuel size={17} />
            Registrar abastecimento
          </Button>
        </div>
        {!vehicles.length && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            Não há veículos cadastrados na sua secretaria.
          </p>
        )}
      </Card>
      {session && (
        <div className="mt-4 flex flex-wrap gap-3">
          <span className="inline-flex items-center rounded-xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
            Utilização ativa: {session.vehicle.placa}
          </span>
          <Button
            onClick={() => open('finish')}
            className="border border-slate-300 bg-white text-navy hover:bg-slate-100"
          >
            <Gauge size={17} />
            Encerrar utilização
          </Button>
        </div>
      )}
    </>
  );
}

function AdminPanel({ data, loading }: { data?: Dashboard; loading: boolean }) {
  if (loading || !data) return <Card>Carregando indicadores...</Card>;
  const t = data.totals,
    usage = t.vehicles ? (t.activeVehicles / t.vehicles) * 100 : 0,
    cards = [
      ['Gasto no mês', money(t.amount)],
      ['Litros consumidos', `${number(t.liters, 1)} L`],
      ['Quota prevista', money(t.quota)],
      ['Solicitações pendentes', String(t.pending)],
      ['Veículos em uso', String(t.activeVehicles)],
      ['Taxa de utilização', `${number(usage, 1)}%`],
    ] as const;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {cards.map(([label, value]) => (
          <div
            key={label}
            className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-medium text-slate-600">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <ActiveVehicles items={data.activeSessions} />
      <AnalyticsCharts data={data} />
      <div className="mt-5 grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Card>
          <h2 className="text-sm font-semibold">Despesa por secretaria</h2>
          <div className="mt-5 space-y-4">
            {data.bySecretaria.length ? (
              data.bySecretaria.map(x => (
                <div key={x.name}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span>{x.name}</span>
                    <b>{money(x.amount)}</b>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-blue"
                      style={{
                        width: `${Math.min(100, (x.amount / Math.max(...data.bySecretaria.map(i => i.amount))) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                Não há abastecimentos aprovados no mês atual.
              </p>
            )}
          </div>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold">Situação da frota</h2>
          <div className="mt-5 flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-[7px] border-blue bg-white text-sm font-bold text-navy">
              {number(usage, 0)}%
            </div>
            <div>
              <p className="text-sm font-semibold">Taxa de utilização</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Proporção da frota que está atualmente em circulação.
              </p>
            </div>
          </div>
          <dl className="mt-5 divide-y divide-slate-200 border-y border-slate-200">
            <div className="flex items-center justify-between py-3">
              <dt className="text-sm text-slate-600">Em utilização</dt>
              <dd className="text-lg font-semibold">{t.activeVehicles}</dd>
            </div>
            <div className="flex items-center justify-between py-3">
              <dt className="text-sm text-slate-600">Disponíveis</dt>
              <dd className="text-lg font-semibold">
                {Math.max(0, t.vehicles - t.activeVehicles)}
              </dd>
            </div>
            <div className="flex items-center justify-between py-3">
              <dt className="text-sm text-slate-600">Total cadastrado</dt>
              <dd className="text-lg font-semibold">{t.vehicles}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </>
  );
}

function ActiveVehicles({ items }: { items: Dashboard['activeSessions'] }) {
  return (
    <Card className="mt-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Veículos em utilização</h2>
          <p className="mt-1 text-sm text-slate-600">
            Acompanhamento atual da frota em circulação.
          </p>
        </div>
        <Badge tone={items.length ? 'green' : 'blue'}>{items.length} EM USO</Badge>
      </div>
      {items.length ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map(item => (
            <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
                  <img
                    src="/branding/vehicle-thumbnail.png"
                    alt="Veículo em utilização"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {item.vehicle.marca} {item.vehicle.modelo}
                  </p>
                  <p className="mt-0.5 font-mono text-xs font-semibold tracking-wider text-slate-600">
                    {item.vehicle.placa}
                  </p>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 text-xs">
                <div>
                  <dt className="text-slate-500">Motorista</dt>
                  <dd className="mt-1 truncate font-medium">{item.user.nome}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Secretaria</dt>
                  <dd className="mt-1 truncate font-medium">{item.vehicle.secretaria.nome}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Km inicial</dt>
                  <dd className="mt-1 font-medium">{number(item.startKm)} km</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Em uso desde</dt>
                  <dd className="mt-1 font-medium">
                    {new Date(item.startedAt).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">
          Nenhum veículo está em utilização neste momento.
        </div>
      )}
    </Card>
  );
}

function AnalyticsCharts({ data }: { data: Dashboard }) {
  const maxMonth = Math.max(1, ...data.analytics.monthly.map(item => item.amount)),
    maxLiters = Math.max(1, ...data.analytics.monthly.map(item => item.liters)),
    statusTotal = Math.max(
      1,
      data.analytics.statuses.reduce((sum, item) => sum + item.count, 0),
    ),
    chartPoints = data.analytics.monthly.map((item, index, items) => ({
      ...item,
      x: 48 + index * (664 / Math.max(1, items.length - 1)),
      y: 184 - (item.amount / maxMonth) * 136,
    })),
    linePath = chartPoints
      .map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`)
      .join(' '),
    areaPath = chartPoints.length
      ? `${linePath} L ${chartPoints.at(-1)!.x} 184 L ${chartPoints[0].x} 184 Z`
      : '',
    previousMonth = data.analytics.monthly.at(-2)?.amount ?? 0,
    currentMonth = data.analytics.monthly.at(-1)?.amount ?? 0,
    trend = previousMonth ? ((currentMonth - previousMonth) / previousMonth) * 100 : 0,
    quotaExecution = data.totals.quota ? (data.totals.amount / data.totals.quota) * 100 : 0,
    averageLiterPrice = data.totals.liters ? data.totals.amount / data.totals.liters : 0;
  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[2fr_1fr]">
      <Card className="overflow-hidden bg-navy text-white xl:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-blue-200">
              <BarChart3 size={15} />
              Inteligência operacional
            </div>
            <h2 className="mt-2 text-xl font-semibold">Visão executiva do consumo da frota</h2>
            <p className="mt-1 text-sm text-slate-300">
              Despesas, volume abastecido e execução orçamentária em uma única leitura.
            </p>
          </div>
          <Badge tone={quotaExecution > 90 ? 'red' : quotaExecution > 75 ? 'yellow' : 'green'}>
            {number(quotaExecution, 1)}% da quota executada
          </Badge>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Custo médio por litro', money(averageLiterPrice), 'Valor aprovado no mês'],
            [
              'Variação mensal',
              `${trend > 0 ? '+' : ''}${number(trend, 1)}%`,
              'Em relação ao mês anterior',
            ],
            [
              'Saldo orçamentário',
              money(Math.max(0, data.totals.quota - data.totals.amount)),
              'Disponível na competência',
            ],
            [
              'Disponibilidade da frota',
              `${Math.max(0, data.totals.vehicles - data.totals.activeVehicles)} veículos`,
              `${data.totals.activeVehicles} em utilização agora`,
            ],
          ].map(([label, value, detail]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[.06] p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-300">
                {label}
              </p>
              <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
              <p className="mt-1 text-xs text-slate-400">{detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-white/[.04] p-3 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-medium text-slate-200">
              Desempenho consolidado — últimos 6 meses
            </span>
            <div className="flex gap-4 text-slate-300">
              <span className="flex items-center gap-1.5">
                <i className="h-0.5 w-5 bg-cyan-300" /> Despesa
              </span>
              <span className="flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-sm bg-blue-400/70" /> Litros
              </span>
            </div>
          </div>
          <svg
            viewBox="0 0 760 240"
            className="h-auto min-h-56 w-full"
            role="img"
            aria-label="Gráfico combinado de despesas e litros nos últimos seis meses"
          >
            <defs>
              <linearGradient id="expense-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#67e8f9" stopOpacity=".35" />
                <stop offset="100%" stopColor="#67e8f9" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[48, 82, 116, 150, 184].map(y => (
              <line
                key={y}
                x1="48"
                x2="712"
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,.1)"
                strokeDasharray="4 6"
              />
            ))}
            {chartPoints.map(point => {
              const height = (point.liters / maxLiters) * 112;
              return (
                <g key={point.label}>
                  <rect
                    x={point.x - 17}
                    y={184 - height}
                    width="34"
                    height={height}
                    rx="8"
                    fill="rgba(96,165,250,.42)"
                  />
                  <text x={point.x} y="215" textAnchor="middle" fill="#cbd5e1" fontSize="12">
                    {point.label}
                  </text>
                </g>
              );
            })}
            <path d={areaPath} fill="url(#expense-area)" />
            <path
              d={linePath}
              fill="none"
              stroke="#67e8f9"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {chartPoints.map(point => (
              <g key={`point-${point.label}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="6"
                  fill="#0f2942"
                  stroke="#67e8f9"
                  strokeWidth="3"
                />
                <text
                  x={point.x}
                  y={Math.max(20, point.y - 13)}
                  textAnchor="middle"
                  fill="white"
                  fontSize="10"
                  fontWeight="600"
                >
                  {point.amount ? money(point.amount) : '—'}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </Card>
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Dias com mais abastecimentos</h2>
            <p className="mt-1 text-xs text-slate-500">
              Frequência e volume aprovado por dia da semana
            </p>
          </div>
          <span className="text-xs text-slate-500">Competência atual</span>
        </div>
        <div className="mt-6 grid h-56 grid-cols-7 items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 pt-5">
          {data.analytics.weekdays.map(item => {
            const max = Math.max(1, ...data.analytics.weekdays.map(day => day.count));
            return (
              <div
                key={item.label}
                className="flex h-full min-w-0 flex-col justify-end text-center"
              >
                <span className="mb-1 text-xs font-semibold tabular-nums">{item.count}</span>
                <span className="mb-2 truncate text-[10px] text-slate-500">
                  {number(item.liters, 1)} L
                </span>
                <div
                  className="mx-auto w-full max-w-12 rounded-t-xl bg-blue"
                  style={{ height: `${Math.max(item.count ? 10 : 2, (item.count / max) * 65)}%` }}
                />
                <span className="py-2 text-xs font-medium text-slate-600">{item.label}</span>
              </div>
            );
          })}
        </div>
      </Card>
      <Card>
        <h2 className="text-sm font-semibold">Horários de pico</h2>
        <p className="mt-1 text-xs text-slate-500">Concentração dos registros ao longo do dia</p>
        <div className="mt-6 space-y-3">
          {data.analytics.hours.map(item => {
            const max = Math.max(1, ...data.analytics.hours.map(hour => hour.count));
            const intensity = item.count / max;
            return (
              <div key={item.label} className="grid grid-cols-[62px_1fr_24px] items-center gap-3">
                <span className="text-xs font-medium text-slate-600">{item.label}</span>
                <div className="grid h-8 grid-cols-8 gap-1">
                  {Array.from({ length: 8 }, (_, index) => (
                    <span
                      key={index}
                      className="rounded-md bg-blue transition-opacity"
                      style={{ opacity: index / 8 < intensity ? 0.3 + index * 0.08 : 0.07 }}
                    />
                  ))}
                </div>
                <b className="text-right text-xs tabular-nums">{item.count}</b>
              </div>
            );
          })}
        </div>
      </Card>
      <Card>
        <h2 className="text-sm font-semibold">Veículos com maior consumo</h2>
        <p className="mt-1 text-xs text-slate-500">Ranking por litros aprovados no mês</p>
        <RankingBars
          items={data.analytics.topVehicles.map(item => ({
            key: item.plate,
            label: item.name,
            detail: `${item.plate} · ${item.count} abastecimento${item.count === 1 ? '' : 's'} · ${money(item.amount)}`,
            value: item.liters,
          }))}
        />
      </Card>
      <Card>
        <h2 className="text-sm font-semibold">Consumo por secretaria</h2>
        <p className="mt-1 text-xs text-slate-500">Volume e gasto aprovado na competência</p>
        <RankingBars
          items={data.analytics.topSecretarias.map(item => ({
            key: item.name,
            label: item.name,
            detail: `${item.count} registro${item.count === 1 ? '' : 's'} · ${money(item.amount)}`,
            value: item.liters,
          }))}
        />
      </Card>
      <Card>
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-sm font-semibold">Evolução das despesas</h2>
            <p className="mt-1 text-xs text-slate-500">
              Abastecimentos aprovados nos últimos seis meses
            </p>
          </div>
          <span className="text-xs text-slate-500">R$</span>
        </div>
        <div
          className="mt-6 flex h-52 items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 pt-4"
          role="img"
          aria-label="Gráfico de despesas mensais"
        >
          {data.analytics.monthly.map(item => (
            <div key={item.label} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              <p className="mb-1 truncate text-center text-[10px] font-medium text-slate-600">
                {item.amount ? money(item.amount) : '—'}
              </p>
              <div
                className="mx-auto w-full max-w-14 rounded-t-xl bg-blue shadow-sm transition-all"
                style={{
                  height: `${Math.max(item.amount ? 6 : 1, (item.amount / maxMonth) * 82)}%`,
                }}
                title={`${item.label}: ${money(item.amount)}`}
              />
              <p className="py-2 text-center text-xs capitalize text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="text-sm font-semibold">Situação das solicitações</h2>
        <p className="mt-1 text-xs text-slate-500">Distribuição no mês atual</p>
        <div className="mt-6 space-y-4">
          {data.analytics.statuses.length ? (
            data.analytics.statuses.map(item => (
              <div key={item.status}>
                <div className="mb-1.5 flex justify-between gap-3 text-xs">
                  <span>{statusName(item.status)}</span>
                  <b>{item.count}</b>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-2 rounded-full ${item.status === 'APPROVED' ? 'bg-emerald-700' : item.status === 'REJECTED' ? 'bg-red-700' : 'bg-amber-600'}`}
                    style={{ width: `${(item.count / statusTotal) * 100}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Sem solicitações no período.</p>
          )}
        </div>
      </Card>
      <Card className="xl:col-span-2">
        <h2 className="text-sm font-semibold">Execução das quotas</h2>
        <p className="mt-1 text-xs text-slate-500">Valor aprovado em relação ao limite mensal</p>
        <div className="mt-5 grid gap-x-8 gap-y-5 md:grid-cols-2">
          {data.analytics.quotaUsage.length ? (
            data.analytics.quotaUsage.map(item => {
              const percent = item.limit ? (item.spent / item.limit) * 100 : 0;
              return (
                <div key={item.name}>
                  <div className="mb-2 flex items-end justify-between gap-3 text-xs">
                    <span className="font-medium">{item.name}</span>
                    <span
                      className={percent > 100 ? 'font-semibold text-red-700' : 'text-slate-600'}
                    >
                      {money(item.spent)} de {money(item.limit)} · {number(percent, 1)}%
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-2.5 rounded-full ${percent > 100 ? 'bg-red-700' : percent > 80 ? 'bg-amber-600' : 'bg-blue'}`}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-500">Nenhuma quota definida para o mês.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
function RankingBars({
  items,
}: {
  items: { key: string; label: string; detail: string; value: number }[];
}) {
  const max = Math.max(1, ...items.map(item => item.value));
  return items.length ? (
    <div className="mt-5 space-y-4">
      {items.map((item, index) => (
        <div key={item.key}>
          <div className="mb-1.5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">
                <span className="mr-2 text-slate-400">{String(index + 1).padStart(2, '0')}</span>
                {item.label}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-slate-500">{item.detail}</p>
            </div>
            <b className="shrink-0 text-xs tabular-nums">{number(item.value, 1)} L</b>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-blue"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  ) : (
    <p className="mt-5 rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
      Sem abastecimentos aprovados na competência.
    </p>
  );
}
function VehiclesSection({
  vehicles,
  loading,
  session,
  driver,
  canCreate,
  canAssign,
  detailBase,
  open,
}: {
  vehicles: Vehicle[];
  loading: boolean;
  session?: Session | null;
  driver: boolean;
  canCreate: boolean;
  canAssign: boolean;
  detailBase: string;
  open: (m: 'start' | 'fuel' | 'finish' | 'vehicle') => void;
}) {
  const pagination = useTablePagination(vehicles);
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{driver ? 'Meu veículo' : 'Veículos'}</h2>
          <p className="mt-1 text-sm text-slate-500">Situação atual da frota.</p>
        </div>
        {driver && !session ? (
          <Button onClick={() => open('start')}>
            <Plus size={17} />
            Assumir
          </Button>
        ) : (
          <div className="flex flex-wrap justify-end gap-2">
            {canAssign && (
              <Button
                onClick={() => open('start')}
                className="border border-slate-300 bg-white text-navy hover:bg-slate-100"
              >
                <Users size={17} />
                Definir utilizador
              </Button>
            )}
            {canCreate && (
              <Button onClick={() => open('vehicle')}>
                <Plus size={17} />
                Cadastrar veículo
              </Button>
            )}
          </div>
        )}
      </div>
      {loading ? (
        <p className="mt-6">Carregando...</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b text-xs uppercase text-slate-400">
              <tr>
                <th className="pb-3">Veículo</th>
                <th className="pb-3">Placa</th>
                <th className="pb-3">Secretaria</th>
                <th className="pb-3">Quilometragem</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedItems.map(v => (
                <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-4 font-semibold">
                    <Link
                      className="text-blue hover:underline"
                      href={`${detailBase}/veiculos/${v.id}`}
                    >
                      {v.marca} {v.modelo}
                    </Link>
                  </td>
                  <td className="py-4 font-mono">{v.placa}</td>
                  <td className="py-4">{v.secretaria.nome}</td>
                  <td className="py-4">{number(v.currentKm)} km</td>
                  <td className="py-4">
                    <Badge tone={v.status === 'AVAILABLE' ? 'green' : 'blue'}>
                      {v.status === 'AVAILABLE' ? 'DISPONÍVEL' : 'EM UTILIZAÇÃO'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination total={vehicles.length} {...pagination.paginationProps} />
        </div>
      )}
    </Card>
  );
}
function RefuelingsSection({
  items,
  loading,
  detailBase,
  canCreate,
  open,
}: {
  items: Refueling[];
  loading: boolean;
  detailBase: string;
  canCreate: boolean;
  open: () => void;
}) {
  const pagination = useTablePagination(items);
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Abastecimentos</h2>
        {canCreate && (
          <Button onClick={open}>
            <Plus size={17} />
            Registrar abastecimento
          </Button>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Abra o processo para consultar as evidências, acompanhar a tramitação e tomar uma decisão.
      </p>
      {loading ? (
        <p className="mt-6">Carregando...</p>
      ) : items.length ? (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b text-xs uppercase text-slate-400">
              <tr>
                <th className="pb-3">ID</th>
                <th className="pb-3">Data</th>
                <th className="pb-3">Motorista</th>
                <th className="pb-3">Secretaria</th>
                <th className="pb-3">Veículo</th>
                <th className="pb-3">Litros</th>
                <th className="pb-3">Valor</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Processo</th>
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedItems.map(i => (
                <tr key={i.id} className="border-b border-slate-100">
                  <td className="py-4 pr-4">
                    <Link
                      className="font-mono text-xs font-semibold text-blue hover:underline"
                      href={`${detailBase}/abastecimentos/${i.id}`}
                    >
                      {i.externalCode ??
                        `ABAST-${(i.secretaria.sigla || i.secretaria.nome)
                          .normalize('NFD')
                          .replace(/[\u0300-\u036f]/g, '')
                          .replace(/[^A-Za-z0-9]/g, '')
                          .toUpperCase()}-${String(i.id).padStart(6, '0')}`}
                    </Link>
                  </td>
                  <td className="py-4">{new Date(i.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td className="py-4">{i.user.nome}</td>
                  <td className="py-4">
                    {i.secretaria.nome}
                    {i.secretaria.sigla ? ` (${i.secretaria.sigla})` : ''}
                  </td>
                  <td className="py-4 font-mono">{i.vehicle.placa}</td>
                  <td className="py-4">{number(i.liters, 2)} L</td>
                  <td className="py-4 font-semibold">{money(i.totalAmount)}</td>
                  <td className="py-4">
                    <Badge
                      tone={
                        i.status === 'APPROVED'
                          ? 'green'
                          : i.status === 'REJECTED'
                            ? 'red'
                            : 'yellow'
                      }
                    >
                      {statusName(i.status)}
                    </Badge>
                  </td>
                  <td className="py-3 text-right">
                    <Link
                      href={`${detailBase}/abastecimentos/${i.id}`}
                      className="inline-flex rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-navy transition hover:border-blue hover:text-blue"
                    >
                      Abrir tramitação
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination total={items.length} {...pagination.paginationProps} />
        </div>
      ) : (
        <p className="mt-6 bg-slate-50 p-5 text-sm text-slate-500">
          Nenhum abastecimento registrado.
        </p>
      )}
    </Card>
  );
}
function DriversSection({
  data,
  loading,
  detailBase,
  open,
}: {
  data?: DriversData;
  loading: boolean;
  detailBase: string;
  open: () => void;
}) {
  const drivers = data?.drivers ?? [];
  const pagination = useTablePagination(drivers);
  return (
    <Card className="quota-print">
      <div className="no-print flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Motoristas cadastrados</h2>
          <p className="mt-1 text-sm text-slate-600">
            Usuários habilitados para utilizar veículos da frota.
          </p>
        </div>
        {data?.canCreate && (
          <Button onClick={open}>
            <Plus size={17} />
            Cadastrar motorista
          </Button>
        )}
      </div>
      {loading ? (
        <p className="mt-6 text-sm">Carregando motoristas...</p>
      ) : data?.drivers.length ? (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b border-slate-300 text-xs uppercase text-slate-500">
              <tr>
                <th className="pb-3">Nome</th>
                <th className="pb-3">Matrícula</th>
                <th className="pb-3">Secretaria</th>
                <th className="pb-3">Situação</th>
                <th className="pb-3">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedItems.map(driver => (
                <tr key={driver.id} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="py-3 font-medium">
                    <Link
                      className="text-blue hover:underline"
                      href={`${detailBase}/motoristas/${driver.id}`}
                    >
                      {driver.nome}
                    </Link>
                  </td>
                  <td className="py-3 font-mono">{driver.matricula}</td>
                  <td className="py-3">
                    {driver.secretaria?.sigla || driver.secretaria?.nome || '—'}
                  </td>
                  <td className="py-3">
                    <Badge tone={driver.ativo ? 'green' : 'red'}>
                      {driver.ativo ? 'ATIVO' : 'INATIVO'}
                    </Badge>
                  </td>
                  <td className="py-3">{new Date(driver.createdAt).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination total={drivers.length} {...pagination.paginationProps} />
        </div>
      ) : (
        <p className="mt-6 border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Nenhum motorista cadastrado.
        </p>
      )}
    </Card>
  );
}
function UsersSection({
  items,
  loading,
  detailBase,
  canCreate,
  open,
}: {
  items: UserRecord[];
  loading: boolean;
  detailBase: string;
  canCreate: boolean;
  open: () => void;
}) {
  const pagination = useTablePagination(items);
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Usuários do sistema</h2>
          <p className="mt-1 text-sm text-slate-600">
            Administradores, secretários e autoridades cadastradas.
          </p>
        </div>
        {canCreate && (
          <Button onClick={open}>
            <Plus size={17} />
            Cadastrar usuário
          </Button>
        )}
      </div>
      {loading ? (
        <p className="mt-6 text-sm">Carregando...</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="border-b border-slate-300 text-xs uppercase text-slate-500">
              <tr>
                <th className="pb-3">Nome</th>
                <th className="pb-3">Matrícula</th>
                <th className="pb-3">Perfil</th>
                <th className="pb-3">Secretaria</th>
                <th className="pb-3">Situação</th>
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedItems.map(item => (
                <tr key={item.id} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="py-3 font-medium">
                    <Link
                      className="text-blue hover:underline"
                      href={`${detailBase}/usuarios/${item.id}`}
                    >
                      {item.nome}
                    </Link>
                  </td>
                  <td className="py-3 font-mono">{item.matricula}</td>
                  <td className="py-3">{roleName(item.role)}</td>
                  <td className="py-3">
                    {item.secretaria?.sigla || item.secretaria?.nome || 'Não vinculada'}
                  </td>
                  <td className="py-3">
                    <Badge tone={item.ativo ? 'green' : 'red'}>
                      {item.ativo ? 'ATIVO' : 'INATIVO'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination total={items.length} {...pagination.paginationProps} />
        </div>
      )}
    </Card>
  );
}
function roleName(role: string) {
  return (
    (
      {
        ADMIN: 'Administrador',
        SECRETARY: 'Secretário',
        GOVERNMENT_SECRETARY: 'Secretário de governo',
        MAYOR: 'Prefeito',
        DRIVER: 'Motorista',
      } as Record<string, string>
    )[role] ?? role
  );
}
function SecretariasSection({
  items,
  loading,
  canCreate,
  detailBase,
  open,
}: {
  items: Secretaria[];
  loading: boolean;
  canCreate: boolean;
  detailBase: string;
  open: () => void;
}) {
  const pagination = useTablePagination(items);
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Secretarias cadastradas</h2>
          <p className="mt-1 text-sm text-slate-600">
            Unidades administrativas vinculadas à frota municipal.
          </p>
        </div>
        {canCreate && (
          <Button onClick={open}>
            <Plus size={17} />
            Cadastrar secretaria
          </Button>
        )}
      </div>
      {loading ? (
        <p className="mt-6 text-sm">Carregando...</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-slate-300 text-xs uppercase text-slate-500">
              <tr>
                <th className="pb-3">Secretaria</th>
                <th className="pb-3">Sigla</th>
                <th className="pb-3">Usuários</th>
                <th className="pb-3">Veículos</th>
                <th className="pb-3">Situação</th>
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedItems.map(item => (
                <tr key={item.id} className="border-b border-slate-200">
                  <td className="py-3 font-medium">
                    <Link
                      className="text-blue hover:underline"
                      href={`${detailBase}/secretarias/${item.id}`}
                    >
                      {item.nome}
                    </Link>
                  </td>
                  <td className="py-3">{item.sigla || '—'}</td>
                  <td className="py-3">{item._count.usuarios}</td>
                  <td className="py-3">{item._count.veiculos}</td>
                  <td className="py-3">
                    <Badge tone={item.ativo ? 'green' : 'red'}>
                      {item.ativo ? 'ATIVA' : 'INATIVA'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination total={items.length} {...pagination.paginationProps} />
        </div>
      )}
    </Card>
  );
}
function stationPrice(station: GasStation, fuelType?: string | null) {
  const fuel = (fuelType || 'GASOLINA').toUpperCase();
  return fuel.includes('ETANOL')
    ? station.ethanolPrice
    : fuel.includes('DIESEL')
      ? station.dieselPrice
      : station.gasolinePrice;
}
function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = (value: number) => (value * Math.PI) / 180,
    earth = 6371,
    dLat = rad(b.latitude - a.latitude),
    dLon = rad(b.longitude - a.longitude),
    value =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
function stationMapUrl(station: GasStation) {
  const span = 0.018,
    left = station.longitude - span,
    right = station.longitude + span,
    bottom = station.latitude - span,
    top = station.latitude + span;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${station.latitude}%2C${station.longitude}`;
}
function StationsSection({
  items,
  loading,
  canCreate,
  detailBase,
  showDetails,
  open,
}: {
  items: GasStation[];
  loading: boolean;
  canCreate: boolean;
  detailBase: string;
  showDetails: boolean;
  open: () => void;
}) {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null),
    [selectedId, setSelectedId] = useState(items[0]?.id ?? 0),
    [error, setError] = useState('');
  const ordered = [...items].sort((a, b) =>
      location ? distanceKm(location, a) - distanceKm(location, b) : a.name.localeCompare(b.name),
    ),
    selected = items.find(item => item.id === selectedId) ?? ordered[0];
  async function locate() {
    setError('');
    try {
      const current = await deviceLocation();
      setLocation(current);
      const nearest = [...items].sort((a, b) => distanceKm(current, a) - distanceKm(current, b))[0];
      if (nearest) setSelectedId(nearest.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível obter a localização.');
    }
  }
  return (
    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Postos credenciados</h2>
            <p className="mt-1 text-sm text-slate-600">
              {location
                ? 'Ordenados pela distância atual.'
                : 'Permita a localização para encontrar o mais próximo.'}
            </p>
          </div>
          {canCreate && (
            <Button onClick={open}>
              <Plus size={17} />
              Novo posto credenciado
            </Button>
          )}
        </div>
        <Button
          onClick={locate}
          className="mt-5 w-full border border-slate-300 bg-white text-navy hover:bg-slate-100"
        >
          <MapPin size={17} />
          Usar minha localização
        </Button>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        <div className="mt-4 space-y-2">
          {loading ? (
            <p className="text-sm">Carregando...</p>
          ) : (
            ordered.map((station, index) => (
              <button
                type="button"
                key={station.id}
                onClick={() => setSelectedId(station.id)}
                className={`w-full rounded-2xl border p-4 text-left ${selected?.id === station.id ? 'border-blue bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <div className="flex justify-between gap-3">
                  <b>{station.name}</b>
                  {location && (
                    <span className="text-xs font-semibold text-blue">
                      {number(distanceKm(location, station), 1)} km
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-600">{station.address}</p>
                {index === 0 && location && <Badge tone="green">MAIS PRÓXIMO</Badge>}
              </button>
            ))
          )}
        </div>
      </Card>
      <Card>
        {selected ? (
          <>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{selected.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{selected.address}</p>
                {showDetails && (
                  <Link
                    href={`${detailBase}/postos/${selected.id}`}
                    className="mt-2 inline-flex text-sm font-semibold text-blue hover:underline"
                  >
                    Ver fornecedor e histórico
                  </Link>
                )}
              </div>
              <div className="flex gap-3 text-xs">
                <span>
                  Gasolina <b>{selected.gasolinePrice ? money(selected.gasolinePrice) : '—'}</b>
                </span>
                <span>
                  Etanol <b>{selected.ethanolPrice ? money(selected.ethanolPrice) : '—'}</b>
                </span>
                <span>
                  Diesel <b>{selected.dieselPrice ? money(selected.dieselPrice) : '—'}</b>
                </span>
              </div>
            </div>
            <iframe
              title={`Mapa de ${selected.name}`}
              src={stationMapUrl(selected)}
              className="h-[460px] w-full rounded-2xl border border-slate-200"
              loading="lazy"
            />
          </>
        ) : (
          <p className="text-sm text-slate-600">Nenhum posto cadastrado.</p>
        )}
      </Card>
    </div>
  );
}
function QuotasSection({
  data,
  loading,
  detailBase,
  open,
}: {
  data?: QuotasData;
  loading: boolean;
  detailBase: string;
  open: () => void;
}) {
  const quotaItems = data?.items ?? [];
  const pagination = useTablePagination(quotaItems);
  const remaining = Math.max(0, (data?.generalQuota ?? 0) - (data?.allocated ?? 0));
  const allocationPercent = data?.generalQuota ? (data.allocated / data.generalQuota) * 100 : 0;
  const competence = data ? `${String(data.month).padStart(2, '0')}/${data.year}` : '—';
  const generalQuota = data?.generalQuota ?? 0;
  const chartTotal = quotaItems.reduce((sum, item) => sum + item.amountLimit, 0);
  let accumulatedPercent = 0;
  const quotaSlices = quotaItems.map(item => {
    const percent = chartTotal ? (item.amountLimit / chartTotal) * 100 : 0;
    const slice = {
      ...item,
      color: secretariaColor(item.id),
      percent,
      start: accumulatedPercent,
      end: accumulatedPercent + percent,
    };
    accumulatedPercent += percent;
    return slice;
  });
  const pieBackground = chartTotal
    ? `conic-gradient(${quotaSlices
        .filter(item => item.percent > 0)
        .map(item => `${item.color} ${item.start}% ${item.end}%`)
        .join(', ')})`
    : '#e2e8f0';
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Quotas por secretaria</h2>
          <p className="mt-1 text-sm text-slate-600">
            Limites para{' '}
            {data ? `${String(data.month).padStart(2, '0')}/${data.year}` : 'o mês atual'}.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {data && (
            <Button
              type="button"
              className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              onClick={() => window.print()}
            >
              <Printer size={17} />
              Imprimir distribuição
            </Button>
          )}
          {data?.canManage && (
            <Button onClick={open}>
              <Plus size={17} />
              Definir quota
            </Button>
          )}
        </div>
      </div>
      {data && (
        <div className="quota-print-heading print-only hidden">
          <h1>Distribuição mensal de quotas</h1>
          <p>Competência: {competence}</p>
        </div>
      )}
      {!loading && data && (
        <div className="mt-6 rounded-3xl border border-blue/20 bg-blue/5 p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-slate-600">Quota geral municipal</p>
              <p className="mt-1 text-2xl font-semibold">{money(data.generalQuota)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600">Distribuído às secretarias</p>
              <p className="mt-1 text-2xl font-semibold">{money(data.allocated)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600">Saldo para distribuir</p>
              <p className="mt-1 text-2xl font-semibold text-blue">{money(remaining)}</p>
            </div>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
            <div
              className={`h-full rounded-full ${allocationPercent >= 100 ? 'bg-red-700' : allocationPercent > 80 ? 'bg-amber-600' : 'bg-blue'}`}
              style={{ width: `${Math.min(100, allocationPercent)}%` }}
            />
          </div>
          <p className="mt-2 text-right text-xs font-medium text-slate-600">
            {number(allocationPercent, 1)}% da quota geral distribuída
          </p>
        </div>
      )}
      {!loading && quotaItems.length > 0 && (
        <div className="no-print mt-6 rounded-3xl border border-slate-200 p-5">
          <div>
            <h3 className="text-sm font-semibold">Distribuição por secretaria</h3>
            <p className="mt-1 text-xs text-slate-500">
              Comparativo dos limites mensais definidos para {competence}.
            </p>
          </div>
          <div className="mt-6 grid items-center gap-8 md:grid-cols-[minmax(220px,320px)_1fr]">
            <div
              className="mx-auto aspect-square w-full max-w-[320px] rounded-full border-4 border-white shadow-sm ring-1 ring-slate-200"
              style={{ background: pieBackground }}
              role="img"
              aria-label={`Gráfico de pizza das quotas mensais por secretaria para ${competence}`}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              {quotaSlices.map(item => (
                <Link
                  key={item.id}
                  href={`${detailBase}/secretarias/${item.id}`}
                  className="group flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue/40"
                  aria-label={`Abrir detalhes da secretaria ${item.nome}`}
                >
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-700 group-hover:text-blue">
                      {item.sigla || item.nome}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {money(item.amountLimit)} · {number(item.percent, 1)}%
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
      {loading ? (
        <p className="mt-6 text-sm">Carregando...</p>
      ) : (
        <div className="no-print mt-6 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-slate-300 text-xs uppercase text-slate-500">
              <tr>
                <th className="pb-3">Secretaria</th>
                <th className="pb-3">Competência</th>
                <th className="pb-3 text-right">Limite mensal</th>
                <th className="pb-3 text-right">Participação</th>
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedItems.map(item => (
                <tr key={item.id} className="border-b border-slate-200">
                  <td className="py-3 font-medium">
                    <Link
                      href={`${detailBase}/secretarias/${item.id}`}
                      className="text-blue hover:underline"
                    >
                      {item.sigla ? `${item.sigla} — ` : ''}
                      {item.nome}
                    </Link>
                  </td>
                  <td className="py-3">{competence}</td>
                  <td className="py-3 text-right font-semibold">{money(item.amountLimit)}</td>
                  <td className="py-3 text-right text-slate-600">
                    {number(generalQuota ? (item.amountLimit / generalQuota) * 100 : 0, 1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination total={quotaItems.length} {...pagination.paginationProps} />
        </div>
      )}
      {!loading && data && (
        <div className="print-only hidden">
          <table>
            <thead>
              <tr>
                <th>Secretaria / Entidade</th>
                <th>Competência</th>
                <th className="text-right">Quota mensal</th>
                <th className="text-right">Participação</th>
              </tr>
            </thead>
            <tbody>
              {quotaItems.map(item => (
                <tr key={item.id}>
                  <td>
                    {item.sigla ? `${item.sigla} — ` : ''}
                    {item.nome}
                  </td>
                  <td>{competence}</td>
                  <td className="text-right">{money(item.amountLimit)}</td>
                  <td className="text-right">
                    {number(generalQuota ? (item.amountLimit / generalQuota) * 100 : 0, 1)}%
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={2}>Total distribuído</th>
                <th className="text-right">{money(data.allocated)}</th>
                <th className="text-right">{number(allocationPercent, 1)}%</th>
              </tr>
              <tr>
                <th colSpan={2}>Quota geral municipal</th>
                <th className="text-right">{money(data.generalQuota)}</th>
                <th className="text-right">100,0%</th>
              </tr>
              <tr>
                <th colSpan={2}>Saldo disponível</th>
                <th className="text-right">{money(remaining)}</th>
                <th />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}

function secretariaColor(id: number) {
  const hue = (id * 137.508 + 23) % 360;
  return `hsl(${hue} 68% 48%)`;
}
function refuelingDisplayId(item: Refueling) {
  if (item.externalCode) return item.externalCode;
  const secretaria = (item.secretaria.sigla || item.secretaria.nome)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
  return `ABAST-${secretaria}-${String(item.id).padStart(6, '0')}`;
}
function ReportsSection({ items, loading }: { items: Refueling[]; loading: boolean }) {
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    secretaria: '',
    driver: '',
    vehicle: '',
    station: '',
    status: '',
    fuelType: '',
    minLiters: '',
    maxLiters: '',
    minAmount: '',
    maxAmount: '',
  });
  const setFilter = (field: keyof typeof filters, value: string) =>
      setFilters(current => ({ ...current, [field]: value })),
    unique = (values: Array<string | null | undefined>) =>
      [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
    secretarias = unique(items.map(item => item.secretaria.nome)),
    drivers = unique(items.map(item => item.user.nome)),
    vehicles = unique(items.map(item => item.vehicle.placa)),
    stations = unique(items.map(item => item.fuelStation)),
    statuses = unique(items.map(item => item.status)),
    fuelTypes = unique(items.map(item => item.fuelType)),
    filtered = items.filter(item => {
      const date = item.createdAt.slice(0, 10);
      return (
        (!filters.from || date >= filters.from) &&
        (!filters.to || date <= filters.to) &&
        (!filters.secretaria || item.secretaria.nome === filters.secretaria) &&
        (!filters.driver || item.user.nome === filters.driver) &&
        (!filters.vehicle || item.vehicle.placa === filters.vehicle) &&
        (!filters.station || item.fuelStation === filters.station) &&
        (!filters.status || item.status === filters.status) &&
        (!filters.fuelType || item.fuelType === filters.fuelType) &&
        (!filters.minLiters || item.liters >= Number(filters.minLiters)) &&
        (!filters.maxLiters || item.liters <= Number(filters.maxLiters)) &&
        (!filters.minAmount || item.totalAmount >= Number(filters.minAmount)) &&
        (!filters.maxAmount || item.totalAmount <= Number(filters.maxAmount))
      );
    }),
    total = filtered.reduce((sum, item) => sum + item.totalAmount, 0),
    liters = filtered.reduce((sum, item) => sum + item.liters, 0),
    activeFilters = Object.values(filters).filter(Boolean).length,
    generatedAt = new Date();
  const pagination = useTablePagination(filtered, JSON.stringify(filters));
  function download() {
    const header = [
        'ID do abastecimento',
        'Data',
        'Motorista',
        'Placa',
        'Veículo',
        'Secretaria',
        'Litros',
        'Valor (R$)',
        'Status',
      ],
      rows = filtered.map(i => [
        refuelingDisplayId(i),
        new Date(i.createdAt).toLocaleDateString('pt-BR'),
        i.user.nome,
        i.vehicle.placa,
        `${i.vehicle.marca} ${i.vehicle.modelo}`,
        i.secretaria.nome,
        i.liters.toFixed(2).replace('.', ','),
        i.totalAmount.toFixed(2).replace('.', ','),
        statusName(i.status),
      ]),
      totals = [
        '',
        '',
        '',
        '',
        '',
        'TOTAL',
        liters.toFixed(2).replace('.', ','),
        total.toFixed(2).replace('.', ','),
        '',
      ];
    const csv = [header, ...rows, totals]
      .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(';'))
      .join('\r\n');
    const url = URL.createObjectURL(
        new Blob(['\ufeffsep=;\r\n' + csv], { type: 'text/csv;charset=utf-8' }),
      ),
      link = document.createElement('a');
    link.href = url;
    link.download = `abastecimentos-${generatedAt.toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="report-print">
      <Card className="no-print mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Filtros avançados</h2>
            <p className="mt-1 text-sm text-slate-600">
              Combine os campos para gerar e imprimir somente os registros necessários.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone={activeFilters ? 'blue' : 'green'}>
              {activeFilters ? `${activeFilters} filtros ativos` : 'Todos os registros'}
            </Badge>
            {activeFilters > 0 && (
              <button
                type="button"
                onClick={() =>
                  setFilters({
                    from: '',
                    to: '',
                    secretaria: '',
                    driver: '',
                    vehicle: '',
                    station: '',
                    status: '',
                    fuelType: '',
                    minLiters: '',
                    maxLiters: '',
                    minAmount: '',
                    maxAmount: '',
                  })
                }
                className="text-sm font-semibold text-blue hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FilterInput
            label="Data inicial"
            type="date"
            value={filters.from}
            set={value => setFilter('from', value)}
          />
          <FilterInput
            label="Data final"
            type="date"
            value={filters.to}
            set={value => setFilter('to', value)}
          />
          <FilterSelect
            label="Secretaria"
            value={filters.secretaria}
            options={secretarias}
            set={value => setFilter('secretaria', value)}
          />
          <FilterSelect
            label="Motorista"
            value={filters.driver}
            options={drivers}
            set={value => setFilter('driver', value)}
          />
          <FilterSelect
            label="Veículo / placa"
            value={filters.vehicle}
            options={vehicles}
            set={value => setFilter('vehicle', value)}
          />
          <FilterSelect
            label="Posto"
            value={filters.station}
            options={stations}
            set={value => setFilter('station', value)}
          />
          <FilterSelect
            label="Status"
            value={filters.status}
            options={statuses}
            optionLabel={statusName}
            set={value => setFilter('status', value)}
          />
          <FilterSelect
            label="Combustível"
            value={filters.fuelType}
            options={fuelTypes}
            set={value => setFilter('fuelType', value)}
          />
          <FilterInput
            label="Litros mínimos"
            type="number"
            value={filters.minLiters}
            set={value => setFilter('minLiters', value)}
          />
          <FilterInput
            label="Litros máximos"
            type="number"
            value={filters.maxLiters}
            set={value => setFilter('maxLiters', value)}
          />
          <FilterInput
            label="Valor mínimo (R$)"
            type="number"
            value={filters.minAmount}
            set={value => setFilter('minAmount', value)}
          />
          <FilterInput
            label="Valor máximo (R$)"
            type="number"
            value={filters.maxAmount}
            set={value => setFilter('maxAmount', value)}
          />
        </div>
        <p className="mt-4 text-sm font-medium text-slate-700">
          {filtered.length} de {items.length} registros selecionados para o relatório.
        </p>
      </Card>
      <div className="print-only mb-6 hidden border-b-2 border-black pb-3">
        <div className="flex items-center gap-3">
          <img src="/branding/municipal-crest.png" alt="" className="h-14 w-14 object-contain" />
          <div>
            <h1 className="text-xl font-semibold">Prefeitura Municipal</h1>
            <p className="text-sm">Relatório de abastecimentos</p>
            <p className="mt-1 text-xs">Emitido em {generatedAt.toLocaleString('pt-BR')}</p>
          </div>
        </div>
      </div>
      <div className="grid overflow-hidden rounded-[28px] border border-slate-300 bg-white sm:grid-cols-3">
        <div className="p-5">
          <p className="text-xs text-slate-600">Registros</p>
          <p className="mt-2 text-2xl font-semibold">{filtered.length}</p>
        </div>
        <div className="border-t border-slate-200 p-5 sm:border-l sm:border-t-0">
          <p className="text-xs text-slate-600">Volume total</p>
          <p className="mt-2 text-2xl font-semibold">{number(liters, 2)} L</p>
        </div>
        <div className="border-t border-slate-200 p-5 sm:border-l sm:border-t-0">
          <p className="text-xs text-slate-600">Valor total</p>
          <p className="mt-2 text-2xl font-semibold">{money(total)}</p>
        </div>
      </div>
      <Card className="mt-5 report-print">
        <div className="no-print flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Relatório de abastecimentos</h2>
            <p className="mt-1 text-sm text-slate-600">
              Exporte para planilha ou imprima e salve em PDF.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={download} disabled={loading || !filtered.length}>
              <FileBarChart size={17} />
              Baixar CSV
            </Button>
            <Button
              onClick={() => window.print()}
              disabled={loading || !filtered.length}
              className="border border-slate-300 bg-white text-navy hover:bg-slate-100"
            >
              <ClipboardList size={17} />
              Imprimir / PDF
            </Button>
          </div>
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-y border-slate-300 bg-slate-100 text-xs uppercase text-slate-600">
                <th className="px-2 py-2">ID</th>
                <th className="px-2 py-2">Data</th>
                <th className="px-2 py-2">Motorista</th>
                <th className="px-2 py-2">Veículo</th>
                <th className="px-2 py-2">Secretaria</th>
                <th className="px-2 py-2 text-right">Litros</th>
                <th className="px-2 py-2 text-right">Valor</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, index) => (
                <tr
                  key={item.id}
                  className={`${index < pagination.start || index >= pagination.start + pagination.pageSize ? 'hidden report-page-hidden' : ''} border-b border-slate-200`}
                >
                  <td className="px-2 py-2 font-mono text-[11px] font-semibold">
                    {refuelingDisplayId(item)}
                  </td>
                  <td className="px-2 py-2">
                    {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-2 py-2">{item.user.nome}</td>
                  <td className="px-2 py-2">
                    <span className="font-mono">{item.vehicle.placa}</span> · {item.vehicle.marca}{' '}
                    {item.vehicle.modelo}
                  </td>
                  <td className="px-2 py-2">{item.secretaria.nome}</td>
                  <td className="px-2 py-2 text-right">{number(item.liters, 2)}</td>
                  <td className="px-2 py-2 text-right font-medium">{money(item.totalAmount)}</td>
                  <td className="px-2 py-2">{statusName(item.status)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-400 font-semibold">
                <td className="px-2 py-3" colSpan={5}>
                  Total
                </td>
                <td className="px-2 py-3 text-right">{number(liters, 2)} L</td>
                <td className="px-2 py-3 text-right">{money(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
          <TablePagination total={filtered.length} {...pagination.paginationProps} />
        </div>
        {!filtered.length && !loading && (
          <p className="py-6 text-sm text-slate-500">
            Nenhum registro corresponde aos filtros selecionados.
          </p>
        )}
        <div className="print-only mt-6 hidden border-t border-slate-400 pt-2 text-xs">
          Sistema Municipal de Controle de Combustíveis · Documento emitido eletronicamente.
        </div>
      </Card>
    </div>
  );
}
function FilterInput({
  label,
  type,
  value,
  set,
}: {
  label: string;
  type: 'date' | 'number';
  value: string;
  set: (value: string) => void;
}) {
  return (
    <div>
      <label>{label}</label>
      <input
        type={type}
        step={type === 'number' ? '0.01' : undefined}
        min={type === 'number' ? '0' : undefined}
        value={value}
        onChange={event => set(event.target.value)}
      />
    </div>
  );
}
function FilterSelect({
  label,
  value,
  options,
  optionLabel = value => value,
  set,
}: {
  label: string;
  value: string;
  options: string[];
  optionLabel?: (value: string) => string;
  set: (value: string) => void;
}) {
  return (
    <div>
      <label>{label}</label>
      <select value={value} onChange={event => set(event.target.value)}>
        <option value="">Todos</option>
        {options.map(option => (
          <option key={option} value={option}>
            {optionLabel(option)}
          </option>
        ))}
      </select>
    </div>
  );
}
function InfoSection({ title, text }: { title: string; text: string; icon: React.ReactNode }) {
  return (
    <Card>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-3 max-w-2xl border-t border-slate-200 pt-4 text-sm text-slate-600">{text}</p>
    </Card>
  );
}

function Modal({
  title,
  close,
  children,
  allowOverflow = false,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
  allowOverflow?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 grid overflow-hidden bg-navy/55 sm:place-items-center sm:p-5">
      <div
        className={`flex max-h-[100dvh] w-full self-end flex-col rounded-t-3xl bg-white sm:max-h-[calc(100dvh-2.5rem)] sm:max-w-lg sm:self-auto sm:rounded-3xl ${allowOverflow ? 'overflow-visible' : 'overflow-hidden'}`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-7">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={close} className="rounded-full bg-slate-100 p-2">
            <X size={18} />
          </button>
        </div>
        <div
          className={`min-h-0 flex-1 overscroll-contain p-5 sm:p-7 ${allowOverflow ? 'overflow-visible' : 'overflow-y-auto'}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
function deviceLocation() {
  return new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    if (!navigator.geolocation)
      return reject(new Error('Localização não disponível neste dispositivo.'));
    navigator.geolocation.getCurrentPosition(
      position =>
        resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => reject(new Error('Permita o acesso à localização para continuar.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}
function StartModal({
  vehicles,
  drivers,
  user,
  close,
  done,
}: {
  vehicles: Vehicle[];
  drivers: Driver[];
  user: User;
  close: () => void;
  done: () => void;
}) {
  const delegated = user.role === 'SECRETARY';
  const [driverId, setDriverId] = useState(delegated ? 0 : user.id),
    [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? 0),
    vehicle = vehicles.find(v => v.id === vehicleId),
    [km, setKm] = useState(vehicle?.currentKm ?? 0),
    [photo, setPhoto] = useState<File | null>(null),
    [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null),
    [locationError, setLocationError] = useState(''),
    [locating, setLocating] = useState(false);
  async function locate() {
    setLocating(true);
    setLocationError('');
    try {
      setLocation(await deviceLocation());
    } catch (error) {
      setLocationError(
        error instanceof Error ? error.message : 'Não foi possível obter a localização.',
      );
    } finally {
      setLocating(false);
    }
  }
  const mutation = useMutation({
    mutationFn: async () => {
      if (!photo) throw new Error('Tire uma foto do hodômetro.');
      if (!location) throw new Error('Autorize e capture a localização do dispositivo.');
      const uploaded = await uploadImage(photo);
      return api('/vehicle-sessions/start', {
        method: 'POST',
        body: JSON.stringify({
          driverId: delegated ? driverId : undefined,
          vehicleId,
          startKm: km,
          startPhoto: uploaded.url,
          startLatitude: location.latitude,
          startLongitude: location.longitude,
        }),
      });
    },
    onSuccess: done,
  });
  return (
    <Modal title={delegated ? 'Definir utilizador do veículo' : 'Assumir veículo'} close={close}>
      <form
        onSubmit={e => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        {delegated && (
          <div className="mb-4">
            <label>Motorista utilizador</label>
            <select value={driverId} onChange={event => setDriverId(Number(event.target.value))}>
              <option value={0}>Selecione o motorista</option>
              {drivers.map(driver => (
                <option key={driver.id} value={driver.id}>
                  {driver.nome} · {driver.matricula}
                </option>
              ))}
            </select>
          </div>
        )}
        <label>Veículo disponível</label>
        <select
          value={vehicleId}
          onChange={e => {
            const id = Number(e.target.value);
            setVehicleId(id);
            setKm(vehicles.find(v => v.id === id)?.currentKm ?? 0);
          }}
        >
          {vehicles
            .filter(v => v.status === 'AVAILABLE')
            .map(v => (
              <option value={v.id} key={v.id}>
                {v.marca} {v.modelo} · {v.placa}
              </option>
            ))}
        </select>
        {vehicle && vehicle.secretaria.id !== user.secretariaId && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <b>Aviso:</b> este veículo pertence à secretaria {vehicle.secretaria.nome}. A utilização
            será permitida e registrada para fins de controle.
          </div>
        )}
        <div className="mt-4">
          <label>KM inicial</label>
          <input type="number" value={km || ''} onChange={e => setKm(Number(e.target.value))} />
        </div>
        <div className="mt-4">
          <label>Foto do hodômetro</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={e => setPhoto(e.target.files?.[0] ?? null)}
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            Fotografe o painel com a quilometragem legível.
          </p>
        </div>
        <div className="mt-4">
          <label>Localização do dispositivo</label>
          <Button
            type="button"
            onClick={locate}
            busy={locating}
            className={location ? 'w-full bg-emerald-700 hover:bg-emerald-800' : 'w-full'}
          >
            {location ? 'Localização capturada' : 'Permitir localização'}
          </Button>
          {location && (
            <p className="mt-1 text-xs text-slate-500">Coordenadas registradas com sucesso.</p>
          )}
          {locationError && <p className="mt-2 text-sm text-red-700">{locationError}</p>}
        </div>
        {mutation.error && <p className="mt-4 text-sm text-red-600">{mutation.error.message}</p>}
        <Button
          busy={mutation.isPending}
          disabled={(delegated && !driverId) || !vehicleId || !photo || !location}
          className="mt-6 w-full"
        >
          {delegated ? 'Definir como utilizador' : 'Confirmar utilização'}
        </Button>
      </form>
    </Modal>
  );
}
function DriverModal({
  data,
  user,
  close,
  done,
}: {
  data: DriversData;
  user: User;
  close: () => void;
  done: () => void;
}) {
  const [nome, setNome] = useState(''),
    [matricula, setMatricula] = useState(''),
    [senha, setSenha] = useState(''),
    [secretariaId, setSecretariaId] = useState(data.secretarias[0]?.id ?? 0);
  const restricted = false;
  const mutation = useMutation({
    mutationFn: () =>
      api('/drivers', {
        method: 'POST',
        body: JSON.stringify({ nome, matricula, senha, secretariaId }),
      }),
    onSuccess: done,
  });
  return (
    <Modal title="Cadastrar motorista" close={close}>
      <form
        onSubmit={e => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div>
          <label>Nome completo</label>
          <input value={nome} onChange={e => setNome(e.target.value)} required minLength={3} />
        </div>
        <div className="mt-4">
          <label>Matrícula</label>
          <input
            value={matricula}
            onChange={e => setMatricula(e.target.value)}
            required
            minLength={3}
            autoComplete="off"
          />
        </div>
        {!restricted && (
          <div className="mt-4">
            <label>Secretaria</label>
            <select
              value={secretariaId}
              onChange={e => setSecretariaId(Number(e.target.value))}
              required
            >
              <option value={0} disabled>
                Selecione
              </option>
              {data.secretarias.map(secretaria => (
                <option key={secretaria.id} value={secretaria.id}>
                  {secretaria.sigla ? `${secretaria.sigla} — ` : ''}
                  {secretaria.nome}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="mt-4">
          <label>Senha inicial</label>
          <input
            type="password"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
          <p className="mt-1 text-xs text-slate-500">Mínimo de 6 caracteres.</p>
        </div>
        {mutation.error && (
          <p className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {mutation.error.message}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            onClick={close}
            className="border border-slate-300 bg-white text-navy hover:bg-slate-100"
          >
            Cancelar
          </Button>
          <Button busy={mutation.isPending}>Cadastrar</Button>
        </div>
      </form>
    </Modal>
  );
}
function VehicleModal({
  secretarias,
  user,
  close,
  done,
}: {
  secretarias: Secretaria[];
  user: User;
  close: () => void;
  done: () => void;
}) {
  const [placa, setPlaca] = useState(''),
    [patrimonio, setPatrimonio] = useState(''),
    [marca, setMarca] = useState(''),
    [modelo, setModelo] = useState(''),
    [ano, setAno] = useState(new Date().getFullYear()),
    [fuelType, setFuelType] = useState('GASOLINA'),
    [tankCapacity, setTankCapacity] = useState(0),
    [currentKm, setCurrentKm] = useState(0),
    [secretariaId, setSecretariaId] = useState(secretarias[0]?.id ?? 0);
  const restricted = false;
  const mutation = useMutation({
    mutationFn: () =>
      api('/vehicles', {
        method: 'POST',
        body: JSON.stringify({
          placa,
          patrimonio,
          marca,
          modelo,
          ano,
          fuelType,
          tankCapacity: tankCapacity || undefined,
          currentKm,
          secretariaId,
        }),
      }),
    onSuccess: done,
  });
  return (
    <Modal title="Cadastrar veículo" close={close}>
      <form
        onSubmit={e => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label>Placa</label>
            <input
              value={placa}
              onChange={e => setPlaca(e.target.value.toUpperCase())}
              required
              minLength={7}
              maxLength={8}
            />
          </div>
          <div>
            <label>Patrimônio</label>
            <input value={patrimonio} onChange={e => setPatrimonio(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label>Marca</label>
            <input value={marca} onChange={e => setMarca(e.target.value)} required />
          </div>
          <div>
            <label>Modelo</label>
            <input value={modelo} onChange={e => setModelo(e.target.value)} required />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label>Ano</label>
            <input
              type="number"
              min="1950"
              max="2100"
              value={ano}
              onChange={e => setAno(Number(e.target.value))}
            />
          </div>
          <div>
            <label>Quilometragem</label>
            <input
              type="number"
              min="0"
              value={currentKm}
              onChange={e => setCurrentKm(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label>Combustível</label>
            <select value={fuelType} onChange={e => setFuelType(e.target.value)}>
              <option>GASOLINA</option>
              <option>ETANOL</option>
              <option>DIESEL</option>
              <option>FLEX</option>
              <option>ELÉTRICO</option>
            </select>
          </div>
          <div>
            <label>Tanque (litros)</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={tankCapacity || ''}
              onChange={e => setTankCapacity(Number(e.target.value))}
            />
          </div>
        </div>
        {!restricted && (
          <div className="mt-4">
            <label>Secretaria</label>
            <select
              value={secretariaId}
              onChange={e => setSecretariaId(Number(e.target.value))}
              required
            >
              {secretarias.map(s => (
                <option key={s.id} value={s.id}>
                  {s.sigla ? `${s.sigla} — ` : ''}
                  {s.nome}
                </option>
              ))}
            </select>
          </div>
        )}
        {mutation.error && (
          <p className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {mutation.error.message}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            onClick={close}
            className="border border-slate-300 bg-white text-navy hover:bg-slate-100"
          >
            Cancelar
          </Button>
          <Button busy={mutation.isPending}>Cadastrar</Button>
        </div>
      </form>
    </Modal>
  );
}
function UserModal({ close, done }: { close: () => void; done: () => void }) {
  const [nome, setNome] = useState(''),
    [matricula, setMatricula] = useState(''),
    [senha, setSenha] = useState(''),
    [role, setRole] = useState('SECRETARY');
  const mutation = useMutation({
    mutationFn: () =>
      api('/users', { method: 'POST', body: JSON.stringify({ nome, matricula, senha, role }) }),
    onSuccess: done,
  });
  return (
    <Modal title="Cadastrar usuário" close={close}>
      <form
        onSubmit={e => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <label>Nome completo</label>
        <input value={nome} onChange={e => setNome(e.target.value)} required minLength={3} />
        <div className="mt-4">
          <label>Matrícula</label>
          <input value={matricula} onChange={e => setMatricula(e.target.value)} required />
        </div>
        <div className="mt-4">
          <label>Perfil</label>
          <select value={role} onChange={e => setRole(e.target.value)}>
            <option value="SECRETARY">Secretário</option>
            <option value="GOVERNMENT_SECRETARY">Secretário de governo</option>
            <option value="MAYOR">Prefeito</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </div>
        <div className="mt-4">
          <label>Senha inicial</label>
          <input
            type="password"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            minLength={6}
            required
            autoComplete="new-password"
          />
        </div>
        {mutation.error && (
          <p className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {mutation.error.message}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            onClick={close}
            className="border border-slate-300 bg-white text-navy hover:bg-slate-100"
          >
            Cancelar
          </Button>
          <Button busy={mutation.isPending}>Cadastrar</Button>
        </div>
      </form>
    </Modal>
  );
}
function SecretariaModal({
  users,
  close,
  done,
}: {
  users: UserRecord[];
  close: () => void;
  done: () => void;
}) {
  const available = users.filter(item => item.role === 'SECRETARY'),
    [nome, setNome] = useState(''),
    [sigla, setSigla] = useState(''),
    [secretarioId, setSecretarioId] = useState(available[0]?.id ?? 0);
  const mutation = useMutation({
    mutationFn: () =>
      api('/secretarias', { method: 'POST', body: JSON.stringify({ nome, sigla, secretarioId }) }),
    onSuccess: done,
  });
  return (
    <Modal title="Cadastrar secretaria" close={close}>
      <form
        onSubmit={e => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <label>Nome da secretaria</label>
        <input value={nome} onChange={e => setNome(e.target.value)} required minLength={3} />
        <div className="mt-4">
          <label>Sigla</label>
          <input
            value={sigla}
            onChange={e => setSigla(e.target.value.toUpperCase())}
            maxLength={12}
          />
        </div>
        <div className="mt-4">
          <label>Secretário responsável</label>
          <select
            value={secretarioId}
            onChange={e => setSecretarioId(Number(e.target.value))}
            required
          >
            <option value={0} disabled>
              Selecione um usuário
            </option>
            {available.map(item => (
              <option key={item.id} value={item.id}>
                {item.nome} · {item.matricula}
              </option>
            ))}
          </select>
          {!available.length && (
            <p className="mt-2 text-xs text-amber-700">
              Cadastre primeiro um usuário com perfil Secretário.
            </p>
          )}
        </div>
        {mutation.error && (
          <p className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {mutation.error.message}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            onClick={close}
            className="border border-slate-300 bg-white text-navy hover:bg-slate-100"
          >
            Cancelar
          </Button>
          <Button busy={mutation.isPending} disabled={!available.length}>
            Cadastrar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function QuotaModal({
  data,
  close,
  done,
}: {
  data: QuotasData;
  close: () => void;
  done: () => void;
}) {
  const [scope, setScope] = useState<'GENERAL' | 'SECRETARIA'>(
      data.generalQuota > 0 ? 'SECRETARIA' : 'GENERAL',
    ),
    [secretariaId, setSecretariaId] = useState(data.items[0]?.id ?? 0),
    [amountLimit, setAmountLimit] = useState(
      data.generalQuota > 0 ? (data.items[0]?.amountLimit ?? 0) : data.generalQuota,
    );
  const currentAllocation = data.items.find(item => item.id === secretariaId)?.amountLimit ?? 0;
  const availableForSecretaria = data.generalQuota - data.allocated + currentAllocation;
  const mutation = useMutation({
    mutationFn: () =>
      api('/quotas', {
        method: 'POST',
        body: JSON.stringify({
          scope,
          ...(scope === 'SECRETARIA' && { secretariaId }),
          year: data.year,
          month: data.month,
          amountLimit,
        }),
      }),
    onSuccess: done,
  });
  return (
    <Modal title="Definir quota mensal" close={close}>
      <form
        onSubmit={e => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <label>Tipo de quota</label>
        <select
          value={scope}
          onChange={event => {
            const value = event.target.value as 'GENERAL' | 'SECRETARIA';
            setScope(value);
            setAmountLimit(
              value === 'GENERAL' ? data.generalQuota : (data.items[0]?.amountLimit ?? 0),
            );
          }}
        >
          <option value="GENERAL">Quota geral municipal</option>
          <option value="SECRETARIA" disabled={!data.generalQuota}>
            Distribuição para secretaria
          </option>
        </select>
        {scope === 'SECRETARIA' && (
          <div className="mt-4">
            <label>Secretaria</label>
            <select
              value={secretariaId}
              onChange={e => {
                const id = Number(e.target.value);
                setSecretariaId(id);
                setAmountLimit(data.items.find(i => i.id === id)?.amountLimit ?? 0);
              }}
            >
              {data.items.map(item => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                  {item.sigla ? ` (${item.sigla})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="mt-4">
          <label>Competência</label>
          <input value={`${String(data.month).padStart(2, '0')}/${data.year}`} disabled />
        </div>
        <div className="mt-4">
          <label>
            {scope === 'GENERAL' ? 'Valor da quota geral (R$)' : 'Valor distribuído (R$)'}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amountLimit || ''}
            onChange={e => setAmountLimit(Number(e.target.value))}
            required
          />
          {scope === 'SECRETARIA' && (
            <p className="mt-2 text-xs text-slate-500">
              Disponível para esta secretaria: {money(Math.max(0, availableForSecretaria))}
            </p>
          )}
        </div>
        {mutation.error && (
          <p className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {mutation.error.message}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            onClick={close}
            className="border border-slate-300 bg-white text-navy hover:bg-slate-100"
          >
            Cancelar
          </Button>
          <Button busy={mutation.isPending}>
            {scope === 'GENERAL' ? 'Salvar quota geral' : 'Salvar distribuição'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function StationModal({ close, done }: { close: () => void; done: () => void }) {
  const now = new Date();
  const [name, setName] = useState(''),
    [legalName, setLegalName] = useState(''),
    [cnpj, setCnpj] = useState(''),
    [phone, setPhone] = useState(''),
    [contractNumber, setContractNumber] = useState(''),
    [address, setAddress] = useState(''),
    [latitude, setLatitude] = useState(0),
    [longitude, setLongitude] = useState(0),
    [gasolinePrice, setGasolinePrice] = useState(0),
    [ethanolPrice, setEthanolPrice] = useState(0),
    [dieselPrice, setDieselPrice] = useState(0),
    [allowanceYear, setAllowanceYear] = useState(now.getFullYear()),
    [allowanceMonth, setAllowanceMonth] = useState(now.getMonth() + 1),
    [litersLimit, setLitersLimit] = useState(0),
    [locationError, setLocationError] = useState('');
  async function locate() {
    setLocationError('');
    try {
      const position = await deviceLocation();
      setLatitude(position.latitude);
      setLongitude(position.longitude);
    } catch (error) {
      setLocationError(
        error instanceof Error ? error.message : 'Não foi possível obter a localização.',
      );
    }
  }
  const mutation = useMutation({
    mutationFn: () =>
      api('/stations', {
        method: 'POST',
        body: JSON.stringify({
          name,
          legalName,
          cnpj,
          phone: phone || undefined,
          contractNumber: contractNumber || undefined,
          address,
          latitude,
          longitude,
          gasolinePrice: gasolinePrice || undefined,
          ethanolPrice: ethanolPrice || undefined,
          dieselPrice: dieselPrice || undefined,
          allowanceYear,
          allowanceMonth,
          litersLimit,
        }),
      }),
    onSuccess: done,
  });
  return (
    <Modal title="Cadastrar posto credenciado" close={close}>
      <form
        onSubmit={event => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <label>Nome do posto</label>
        <input value={name} onChange={event => setName(event.target.value)} required />
        <div className="mt-4">
          <label>Razão social</label>
          <input value={legalName} onChange={event => setLegalName(event.target.value)} required />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label>CNPJ</label>
            <input
              inputMode="numeric"
              value={cnpj}
              onChange={event => setCnpj(event.target.value)}
              placeholder="00.000.000/0000-00"
              required
            />
          </div>
          <div>
            <label>Telefone</label>
            <input value={phone} onChange={event => setPhone(event.target.value)} />
          </div>
        </div>
        <div className="mt-4">
          <label>Número do contrato</label>
          <input value={contractNumber} onChange={event => setContractNumber(event.target.value)} />
        </div>
        <div className="mt-4">
          <label>Endereço</label>
          <input value={address} onChange={event => setAddress(event.target.value)} required />
        </div>
        <div className="mt-4">
          <Button
            type="button"
            onClick={locate}
            className="w-full border border-slate-300 bg-white text-navy hover:bg-slate-100"
          >
            <MapPin size={17} />
            Capturar localização do posto
          </Button>
          {locationError && <p className="mt-2 text-sm text-red-700">{locationError}</p>}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label>Latitude</label>
            <input
              type="number"
              step="any"
              value={latitude || ''}
              onChange={event => setLatitude(Number(event.target.value))}
              required
            />
          </div>
          <div>
            <label>Longitude</label>
            <input
              type="number"
              step="any"
              value={longitude || ''}
              onChange={event => setLongitude(Number(event.target.value))}
              required
            />
          </div>
        </div>
        {latitude !== 0 && longitude !== 0 && (
          <LocationPicker
            latitude={latitude}
            longitude={longitude}
            onChange={position => {
              setLatitude(position.latitude);
              setLongitude(position.longitude);
            }}
          />
        )}
        <div className="mt-5 border-t border-slate-200 pt-4">
          <p className="mb-3 text-sm font-semibold">Preço por litro</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label>Gasolina</label>
              <input
                type="number"
                min="0"
                step=".001"
                value={gasolinePrice || ''}
                onChange={event => setGasolinePrice(Number(event.target.value))}
              />
            </div>
            <div>
              <label>Etanol</label>
              <input
                type="number"
                min="0"
                step=".001"
                value={ethanolPrice || ''}
                onChange={event => setEthanolPrice(Number(event.target.value))}
              />
            </div>
            <div>
              <label>Diesel</label>
              <input
                type="number"
                min="0"
                step=".001"
                value={dieselPrice || ''}
                onChange={event => setDieselPrice(Number(event.target.value))}
              />
            </div>
          </div>
        </div>
        <div className="mt-5 border-t border-slate-200 pt-4">
          <p className="mb-3 text-sm font-semibold">Litros liberados por competência</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label>Mês</label>
              <select
                value={allowanceMonth}
                onChange={event => setAllowanceMonth(Number(event.target.value))}
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map(month => (
                  <option key={month} value={month}>
                    {String(month).padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Ano</label>
              <input
                type="number"
                min="2020"
                max="2100"
                value={allowanceYear}
                onChange={event => setAllowanceYear(Number(event.target.value))}
              />
            </div>
            <div>
              <label>Limite (L)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={litersLimit || ''}
                onChange={event => setLitersLimit(Number(event.target.value))}
                required
              />
            </div>
          </div>
        </div>
        {mutation.error && <p className="mt-4 text-sm text-red-700">{mutation.error.message}</p>}
        <Button
          busy={mutation.isPending}
          disabled={
            !latitude ||
            !longitude ||
            cnpj.replace(/\D/g, '').length !== 14 ||
            !litersLimit ||
            (!gasolinePrice && !ethanolPrice && !dieselPrice)
          }
          className="mt-6 w-full"
        >
          Cadastrar posto credenciado
        </Button>
      </form>
    </Modal>
  );
}
function FuelModal({
  vehicle,
  driverId,
  driverName,
  sessionId,
  stations,
  allowRetroactive = false,
  allowTotalEntry = false,
  close,
  done,
}: {
  vehicle: Vehicle;
  driverId?: number;
  driverName: string;
  sessionId?: number;
  stations: GasStation[];
  allowRetroactive?: boolean;
  allowTotalEntry?: boolean;
  close: () => void;
  done: () => void;
}) {
  const voucherWindow = useRef<Window | null>(null);
  const compatible = stations.filter(station => stationPrice(station, vehicle.fuelType)),
    [km, setKm] = useState(vehicle.currentKm),
    [liters, setLiters] = useState(0),
    [stationId, setStationId] = useState(compatible[0]?.id ?? 0),
    [otherStation, setOtherStation] = useState(''),
    [otherPrice, setOtherPrice] = useState(0),
    [totalAmount, setTotalAmount] = useState(0),
    [distance, setDistance] = useState<number | null>(null),
    [locationError, setLocationError] = useState(''),
    [receipt, setReceipt] = useState<File | null>(null),
    [pump, setPump] = useState<File | null>(null),
    [odometer, setOdometer] = useState<File | null>(null),
    [refueledAt, setRefueledAt] = useState(() => {
      const now = new Date();
      return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    }),
    station = compatible.find(item => item.id === stationId),
    isOtherStation = stationId === -1,
    isOnSite = stationId === -2,
    isUnregisteredStation = isOtherStation || isOnSite,
    useTotalAmount = allowTotalEntry && totalAmount > 0,
    configuredPrice = isUnregisteredStation
      ? otherPrice
      : station
        ? stationPrice(station, vehicle.fuelType) || 0
        : 0,
    price = useTotalAmount && liters ? totalAmount / liters : configuredPrice;
  async function nearest() {
    setLocationError('');
    try {
      const current = await deviceLocation(),
        ordered = [...compatible].sort((a, b) => distanceKm(current, a) - distanceKm(current, b)),
        closest = ordered[0];
      if (closest) {
        setStationId(closest.id);
        setDistance(distanceKm(current, closest));
      }
    } catch (error) {
      setLocationError(
        error instanceof Error ? error.message : 'Não foi possível obter a localização.',
      );
    }
  }
  const mutation = useMutation({
    mutationFn: async () => {
      if (!station && !isUnregisteredStation) throw new Error('Selecione um posto.');
      if (isOtherStation && !otherStation.trim()) throw new Error('Informe o nome do outro posto.');
      if (isUnregisteredStation && !useTotalAmount && !otherPrice)
        throw new Error('Informe o preço por litro.');
      if (!receipt || !pump || !odometer) throw new Error('As três fotos são obrigatórias.');
      const [receiptUpload, pumpUpload, odometerUpload] = await Promise.all([
        uploadImage(receipt),
        uploadImage(pump),
        uploadImage(odometer),
      ]);
      return api<{ voucherPdf: string | null }>('/refuelings', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          driverId,
          vehicleId: vehicle.id,
          km,
          liters,
          stationId: station?.id,
          fuelStation: isOnSite ? 'Em LOCO' : isOtherStation ? otherStation.trim() : undefined,
          pricePerLiter: price,
          totalAmount: useTotalAmount ? totalAmount : undefined,
          fuelType: vehicle.fuelType || 'GASOLINA',
          receiptPhoto: receiptUpload.url,
          pumpPhoto: pumpUpload.url,
          odometerPhoto: odometerUpload.url,
          refueledAt: allowRetroactive ? new Date(refueledAt).toISOString() : undefined,
        }),
      });
    },
    onSuccess: data => {
      if (data.voucherPdf) {
        if (voucherWindow.current && !voucherWindow.current.closed) {
          voucherWindow.current.location.replace(data.voucherPdf);
        } else {
          window.open(data.voucherPdf, '_blank', 'noopener,noreferrer');
        }
      } else {
        voucherWindow.current?.close();
      }
      voucherWindow.current = null;
      done();
    },
    onError: () => {
      voucherWindow.current?.close();
      voucherWindow.current = null;
    },
  });
  return (
    <Modal title="Novo abastecimento" close={close}>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          voucherWindow.current = window.open('', '_blank');
          if (voucherWindow.current) {
            voucherWindow.current.opener = null;
            voucherWindow.current.document.title = 'Gerando comprovante';
            voucherWindow.current.document.body.innerHTML =
              '<p style="font: 16px sans-serif; padding: 24px">Gerando comprovante do abastecimento...</p>';
          }
          mutation.mutate();
        }}
      >
        <div className="mb-5 rounded-xl bg-slate-50 p-3 text-sm">
          <b>
            {vehicle.marca} {vehicle.modelo}
          </b>{' '}
          · {vehicle.placa}
          <span className="mt-1 block text-xs text-slate-500">
            Motorista: {driverName || 'Não informado'}
          </span>
        </div>
        {allowRetroactive && (
          <div className="mb-4">
            <label>Data e hora do abastecimento</label>
            <input
              type="datetime-local"
              value={refueledAt}
              max={new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
                .toISOString()
                .slice(0, 16)}
              onChange={event => setRefueledAt(event.target.value)}
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              Disponível somente para lançamentos realizados por secretário.
            </p>
          </div>
        )}
        <div>
          <label>Posto</label>
          <select
            value={stationId}
            onChange={event => {
              setStationId(Number(event.target.value));
              setDistance(null);
            }}
            required
          >
            <option value={0} disabled>
              Selecione um posto
            </option>
            {compatible.map(item => (
              <option key={item.id} value={item.id}>
                {item.name} · {money(stationPrice(item, vehicle.fuelType) || 0)}/L
              </option>
            ))}
            <option value={-2}>Em LOCO</option>
            <option value={-1}>Outro posto (não cadastrado)</option>
          </select>
          {!isUnregisteredStation && (
            <Button
              type="button"
              onClick={nearest}
              disabled={!compatible.length}
              className="mt-2 w-full border border-slate-300 bg-white text-navy hover:bg-slate-100"
            >
              <MapPin size={17} />
              Selecionar o posto mais próximo
            </Button>
          )}
          {distance !== null && (
            <p className="mt-2 text-xs font-medium text-emerald-700">
              Posto mais próximo selecionado · {number(distance, 1)} km
            </p>
          )}
          {locationError && <p className="mt-2 text-sm text-red-700">{locationError}</p>}
        </div>
        {isOtherStation && (
          <div className="mt-4 grid gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:grid-cols-2">
            <div>
              <label>Nome do outro posto</label>
              <input
                value={otherStation}
                onChange={event => setOtherStation(event.target.value)}
                placeholder="Informe o nome do estabelecimento"
                required
              />
            </div>
            {!useTotalAmount && (
              <div>
                <label>Preço por litro (R$)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.001"
                  value={otherPrice || ''}
                  onChange={event => setOtherPrice(Number(event.target.value))}
                  required
                />
              </div>
            )}
            <p className="text-xs text-amber-900 sm:col-span-2">
              O processo será sinalizado para análise por ter sido realizado fora da rede
              cadastrada.
            </p>
          </div>
        )}
        {isOnSite && (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            {!useTotalAmount && (
              <>
                <label>Preço por litro (R$)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.001"
                  value={otherPrice || ''}
                  onChange={event => setOtherPrice(Number(event.target.value))}
                  required
                />
              </>
            )}
            <p className="mt-2 text-xs text-blue-900">
              O abastecimento será registrado com o local “Em LOCO”.
            </p>
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label>KM atual</label>
            <input type="number" value={km || ''} onChange={e => setKm(Number(e.target.value))} />
          </div>
          <div>
            <label>Litros</label>
            <input
              type="number"
              step=".01"
              value={liters || ''}
              onChange={e => setLiters(Number(e.target.value))}
            />
          </div>
        </div>
        {allowTotalEntry ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label>Valor total pago (opcional)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={totalAmount || ''}
                onChange={event => setTotalAmount(Number(event.target.value))}
                placeholder="Ex.: 250,00"
              />
            </div>
            <div>
              <label>{useTotalAmount ? 'Preço calculado por litro' : 'Preço por litro'}</label>
              <input value={price ? money(price) : 'Sem preço informado'} disabled />
            </div>
            <p className="text-xs text-slate-500 sm:col-span-2">
              Ao informar o total, o preço por litro será calculado automaticamente.
            </p>
          </div>
        ) : (
          <div className="mt-4">
            <label>Valor por litro</label>
            <input value={price ? money(price) : 'Sem preço informado'} disabled />
          </div>
        )}
        <div className="mt-5 space-y-4 border-t border-slate-200 pt-5">
          <div>
            <label>Foto do comprovante</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={e => setReceipt(e.target.files?.[0] ?? null)}
              required
            />
          </div>
          <div>
            <label>Foto da bomba</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={e => setPump(e.target.files?.[0] ?? null)}
              required
            />
          </div>
          <div>
            <label>Foto do hodômetro</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={e => setOdometer(e.target.files?.[0] ?? null)}
              required
            />
          </div>
        </div>
        <div className="mt-5 flex justify-between rounded-xl bg-blue-50 p-4">
          <span>Total calculado</span>
          <b className="text-blue">{money(useTotalAmount ? totalAmount : liters * price)}</b>
        </div>
        {mutation.error && <p className="mt-4 text-sm text-red-600">{mutation.error.message}</p>}
        <Button
          busy={mutation.isPending}
          disabled={
            (!station && !isUnregisteredStation) ||
            (isOtherStation && (!otherStation.trim() || (!useTotalAmount && !otherPrice))) ||
            (isOnSite && !useTotalAmount && !otherPrice) ||
            !receipt ||
            !pump ||
            !odometer ||
            !liters ||
            (useTotalAmount && !totalAmount)
          }
          className="mt-6 w-full"
        >
          Enviar para aprovação
        </Button>
      </form>
    </Modal>
  );
}

function RefuelingTargetModal({
  drivers,
  vehicles,
  sessions,
  stations,
  allowRetroactive,
  close,
  done,
}: {
  drivers: Driver[];
  vehicles: Vehicle[];
  sessions: Dashboard['activeSessions'];
  stations: GasStation[];
  allowRetroactive: boolean;
  close: () => void;
  done: () => void;
}) {
  const [driverId, setDriverId] = useState(0);
  const [vehicleId, setVehicleId] = useState(0);
  const [vehicleQuery, setVehicleQuery] = useState('');
  const [vehicleLookupOpen, setVehicleLookupOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const driver = drivers.find(item => item.id === driverId);
  const scopedVehicles = driver?.secretaria
    ? vehicles.filter(item => item.secretaria.id === driver.secretaria!.id)
    : vehicles;
  const vehicle = scopedVehicles.find(item => item.id === vehicleId);
  const normalizedVehicleQuery = vehicleQuery.trim().toLocaleLowerCase('pt-BR');
  const suggestedVehicles = scopedVehicles
    .filter(item => {
      if (!normalizedVehicleQuery) return true;
      return `${item.placa} ${item.marca} ${item.modelo}`
        .toLocaleLowerCase('pt-BR')
        .includes(normalizedVehicleQuery);
    })
    .slice(0, 8);
  if (confirmed && vehicle) {
    const activeSession = driver
      ? sessions.find(item => item.user.id === driver.id && item.vehicle.id === vehicle.id)
      : undefined;
    return (
      <FuelModal
        vehicle={vehicle}
        driverId={driver?.id}
        driverName={driver?.nome ?? ''}
        sessionId={activeSession?.id}
        stations={stations}
        allowRetroactive={allowRetroactive}
        allowTotalEntry={allowRetroactive}
        close={close}
        done={done}
      />
    );
  }
  return (
    <Modal title="Novo abastecimento" close={close} allowOverflow>
      <form
        onSubmit={event => {
          event.preventDefault();
          if (vehicle) setConfirmed(true);
        }}
        className="space-y-4"
      >
        <div>
          <label>Motorista (opcional)</label>
          <select
            value={driverId}
            onChange={event => {
              const selectedDriverId = Number(event.target.value);
              setDriverId(selectedDriverId);
              setVehicleId(0);
              setVehicleQuery('');
            }}
            required
          >
            <option value={0}>Não informar motorista</option>
            {drivers.map(item => (
              <option key={item.id} value={item.id}>
                {item.nome} · {item.matricula}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <label>Veículo</label>
          <input
            role="combobox"
            aria-autocomplete="list"
            aria-controls="vehicle-lookup-options"
            aria-expanded={vehicleLookupOpen}
            value={vehicleQuery}
            placeholder="Busque por placa, marca ou modelo"
            autoComplete="off"
            onFocus={() => setVehicleLookupOpen(true)}
            onBlur={() => setTimeout(() => setVehicleLookupOpen(false), 120)}
            onChange={event => {
              setVehicleQuery(event.target.value);
              setVehicleId(0);
              setVehicleLookupOpen(true);
            }}
            required
          />
          {vehicleLookupOpen && scopedVehicles.length > 0 && (
            <div
              id="vehicle-lookup-options"
              role="listbox"
              className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-300 bg-white p-1 shadow-xl"
            >
              {suggestedVehicles.map(item => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={item.id === vehicleId}
                  className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-slate-100"
                  onMouseDown={event => {
                    event.preventDefault();
                    setVehicleId(item.id);
                    setVehicleQuery(`${item.placa} — ${item.marca} ${item.modelo}`);
                    setVehicleLookupOpen(false);
                  }}
                >
                  <span className="block font-mono text-sm font-semibold text-navy">
                    {item.placa}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-600">
                    {item.marca} {item.modelo}
                  </span>
                </button>
              ))}
              {!suggestedVehicles.length && (
                <p className="px-3 py-4 text-sm text-slate-500">Nenhum veículo encontrado.</p>
              )}
            </div>
          )}
          {!scopedVehicles.length && (
            <p className="mt-2 text-sm text-amber-700">
              Não há veículos cadastrados na lotação deste motorista.
            </p>
          )}
        </div>
        {!drivers.length && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            Não há motoristas disponíveis para este lançamento.
          </p>
        )}
        <Button disabled={!vehicle} className="w-full">
          Continuar
        </Button>
      </form>
    </Modal>
  );
}
function FinishModal({
  session,
  close,
  done,
}: {
  session: Session;
  close: () => void;
  done: () => void;
}) {
  const [km, setKm] = useState(session.vehicle.currentKm);
  const [photo, setPhoto] = useState<File | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState('');
  const [locating, setLocating] = useState(false);
  async function locate() {
    setLocating(true);
    setLocationError('');
    try {
      setLocation(await deviceLocation());
    } catch (error) {
      setLocationError(
        error instanceof Error ? error.message : 'Não foi possível obter a localização.',
      );
    } finally {
      setLocating(false);
    }
  }
  const mutation = useMutation({
    mutationFn: async () => {
      if (!photo) throw new Error('Tire uma foto do hodômetro final.');
      if (!location) throw new Error('Capture a localização antes de devolver o veículo.');
      const uploaded = await uploadImage(photo);
      return api(`/vehicle-sessions/${session.id}/finish`, {
        method: 'POST',
        body: JSON.stringify({
          endKm: km,
          endPhoto: uploaded.url,
          endLatitude: location.latitude,
          endLongitude: location.longitude,
        }),
      });
    },
    onSuccess: done,
  });
  return (
    <Modal title="Encerrar utilização" close={close}>
      <form
        onSubmit={e => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <p className="mb-5 text-sm text-slate-500">
          Informe a quilometragem final do {session.vehicle.marca} {session.vehicle.modelo}.
        </p>
        <label>KM final</label>
        <input type="number" value={km || ''} onChange={e => setKm(Number(e.target.value))} />
        <div className="mt-4">
          <label>Foto do hodômetro final</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={e => setPhoto(e.target.files?.[0] ?? null)}
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            Fotografe o painel com a quilometragem final claramente visível.
          </p>
        </div>
        <div className="mt-4">
          <label>Localização da devolução</label>
          <Button
            type="button"
            onClick={locate}
            busy={locating}
            className={location ? 'w-full bg-emerald-700 hover:bg-emerald-800' : 'w-full'}
          >
            {location ? 'Atualizar localização' : 'Capturar localização'}
          </Button>
          {location && (
            <LocationPicker
              latitude={location.latitude}
              longitude={location.longitude}
              onChange={setLocation}
            />
          )}
          {locationError && <p className="mt-2 text-sm text-red-700">{locationError}</p>}
        </div>
        {mutation.error && <p className="mt-4 text-sm text-red-600">{mutation.error.message}</p>}
        <Button
          busy={mutation.isPending}
          disabled={!photo || !location}
          className="mt-6 w-full bg-navy hover:bg-slate-800"
        >
          Finalizar e liberar veículo
        </Button>
      </form>
    </Modal>
  );
}
