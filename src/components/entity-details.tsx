'use client';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BusFront, Fuel, UserRound } from 'lucide-react';
import Link from 'next/link';
import { api, money, number } from '@/lib/api';
import { fuelLabel, statusLabel } from '@/lib/status';
import { Badge, Card } from './ui';
import { PasswordReset } from './password-reset';
import { DashboardDetailLayout } from './dashboard-detail-layout';

type SessionItem = {
  id: number;
  startedAt: string;
  endedAt: string | null;
  startKm: number;
  endKm: number | null;
  status: string;
  user?: { id: number; nome: string; matricula: string };
  vehicle?: { id: number; placa: string; marca: string; modelo: string };
};
type RefuelingItem = {
  id: number;
  createdAt: string;
  km: number;
  liters: number;
  totalAmount: number;
  status: string;
  user?: { id: number; nome: string; matricula: string };
  vehicle?: { id: number; placa: string; marca: string; modelo: string };
};
type VehicleDetail = {
  id: number;
  placa: string;
  patrimonio: string | null;
  marca: string;
  modelo: string;
  ano: number | null;
  fuelType: string | null;
  tankCapacity: number | null;
  currentKm: number;
  status: string;
  secretaria: { nome: string; sigla: string | null };
  sessions: SessionItem[];
  refuelings: RefuelingItem[];
};
type DriverDetail = {
  id: number;
  nome: string;
  matricula: string;
  ativo: boolean;
  secretariaId: number | null;
  canResetPassword: boolean;
  canChangeLotacao: boolean;
  createdAt: string;
  secretaria: { id: number; nome: string; sigla: string | null } | null;
  secretarias: Array<{ id: number; nome: string; sigla: string | null }>;
  sessions: SessionItem[];
  refuelings: RefuelingItem[];
};

const statusTone = (status: string): 'green' | 'red' | 'yellow' | 'blue' =>
  status === 'ACTIVE' || status === 'AVAILABLE' || status === 'APPROVED'
    ? 'green'
    : status === 'INACTIVE' || status === 'REJECTED'
      ? 'red'
      : status.startsWith('WAITING')
        ? 'yellow'
        : 'blue';

function DetailLayout({
  title,
  subtitle,
  back,
  children,
}: {
  title: string;
  subtitle: string;
  back: string;
  children: React.ReactNode;
}) {
  return (
    <DashboardDetailLayout
      base={back.split('/').slice(0, 3).join('/')}
      back={back}
      title={title}
      subtitle={subtitle}
    >
      {children}
    </DashboardDetailLayout>
  );
}

export function VehicleDetails({ id, base }: { id: number; base: string }) {
  const query = useQuery({
    queryKey: ['vehicle', id],
    queryFn: () => api<VehicleDetail>(`/vehicles/${id}`),
  });
  if (query.isLoading)
    return (
      <DetailLayout title="Veículo" subtitle="Carregando dados..." back={`${base}/veiculos`}>
        <Card>Carregando...</Card>
      </DetailLayout>
    );
  if (query.error || !query.data)
    return (
      <DetailLayout
        title="Veículo"
        subtitle="Não foi possível abrir o registro."
        back={`${base}/veiculos`}
      >
        <Card>
          <p className="text-sm text-red-700">
            {query.error?.message || 'Veículo não encontrado.'}
          </p>
        </Card>
      </DetailLayout>
    );
  const v = query.data;
  return (
    <DetailLayout
      title={`${v.marca} ${v.modelo}`}
      subtitle={`Placa ${v.placa}`}
      back={`${base}/veiculos`}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Dados do veículo</h2>
            <Badge tone={statusTone(v.status)}>{statusLabel(v.status)}</Badge>
          </div>
          <dl className="mt-5 divide-y divide-slate-200 border-y border-slate-200 text-sm">
            <Row label="Placa" value={v.placa} />
            <Row label="Patrimônio" value={v.patrimonio || '—'} />
            <Row label="Secretaria" value={v.secretaria.sigla || v.secretaria.nome} />
            <Row label="Ano" value={v.ano?.toString() || '—'} />
            <Row label="Combustível" value={fuelLabel(v.fuelType)} />
            <Row
              label="Capacidade"
              value={v.tankCapacity ? `${number(v.tankCapacity, 1)} L` : '—'}
            />
            <Row label="Quilometragem" value={`${number(v.currentKm)} km`} />
          </dl>
        </Card>
        <div className="space-y-5">
          <History
            title="Utilizações recentes"
            icon={<BusFront size={17} />}
            empty="Nenhuma utilização registrada."
          >
            {v.sessions.map(s => (
              <div
                key={s.id}
                className="grid grid-cols-[1fr_auto] gap-3 border-b border-slate-200 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{s.user?.nome}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(s.startedAt).toLocaleDateString('pt-BR')} · {number(s.startKm)} km
                  </p>
                </div>
                <Badge tone={statusTone(s.status)}>{statusLabel(s.status)}</Badge>
              </div>
            ))}
          </History>
          <History
            title="Abastecimentos recentes"
            icon={<Fuel size={17} />}
            empty="Nenhum abastecimento registrado."
          >
            {v.refuelings.map(r => (
              <div
                key={r.id}
                className="grid grid-cols-[1fr_auto] gap-3 border-b border-slate-200 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {r.user?.nome} · {number(r.liters, 2)} L
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(r.createdAt).toLocaleDateString('pt-BR')} · {number(r.km)} km
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{money(r.totalAmount)}</p>
                  <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge>
                </div>
              </div>
            ))}
          </History>
        </div>
      </div>
    </DetailLayout>
  );
}

export function DriverDetails({ id, base }: { id: number; base: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['driver', id],
    queryFn: () => api<DriverDetail>(`/drivers/${id}`),
  });
  if (query.isLoading)
    return (
      <DetailLayout title="Motorista" subtitle="Carregando dados..." back={`${base}/motoristas`}>
        <Card>Carregando...</Card>
      </DetailLayout>
    );
  if (query.error || !query.data)
    return (
      <DetailLayout
        title="Motorista"
        subtitle="Não foi possível abrir o registro."
        back={`${base}/motoristas`}
      >
        <Card>
          <p className="text-sm text-red-700">
            {query.error?.message || 'Motorista não encontrado.'}
          </p>
        </Card>
      </DetailLayout>
    );
  const d = query.data;
  return (
    <DetailLayout title={d.nome} subtitle={`Matrícula ${d.matricula}`} back={`${base}/motoristas`}>
      <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
        <div className="space-y-5">
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Dados funcionais</h2>
              <Badge tone={d.ativo ? 'green' : 'red'}>{d.ativo ? 'ATIVO' : 'INATIVO'}</Badge>
            </div>
            <dl className="mt-5 divide-y divide-slate-200 border-y border-slate-200 text-sm">
              <Row label="Matrícula" value={d.matricula} />
              <Row label="Secretaria" value={d.secretaria?.sigla || d.secretaria?.nome || '—'} />
              <Row
                label="Cadastrado em"
                value={new Date(d.createdAt).toLocaleDateString('pt-BR')}
              />
            </dl>
            {d.canChangeLotacao && (
              <DriverLotacaoSelector
                driverId={d.id}
                currentId={d.secretariaId}
                secretarias={d.secretarias}
                changed={() => queryClient.invalidateQueries({ queryKey: ['driver', id] })}
              />
            )}
          </Card>
          <PasswordReset userId={d.id} allowed={d.canResetPassword} />
        </div>
        <div className="space-y-5">
          <History
            title="Utilizações recentes"
            icon={<UserRound size={17} />}
            empty="Nenhuma utilização registrada."
          >
            {d.sessions.map(s => (
              <div
                key={s.id}
                className="grid grid-cols-[1fr_auto] gap-3 border-b border-slate-200 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {s.vehicle?.marca} {s.vehicle?.modelo} · {s.vehicle?.placa}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(s.startedAt).toLocaleDateString('pt-BR')} · {number(s.startKm)} km
                  </p>
                </div>
                <Badge tone={statusTone(s.status)}>{statusLabel(s.status)}</Badge>
              </div>
            ))}
          </History>
          <History
            title="Abastecimentos recentes"
            icon={<Fuel size={17} />}
            empty="Nenhum abastecimento registrado."
          >
            {d.refuelings.map(r => (
              <div
                key={r.id}
                className="grid grid-cols-[1fr_auto] gap-3 border-b border-slate-200 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {r.vehicle?.placa} · {number(r.liters, 2)} L
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(r.createdAt).toLocaleDateString('pt-BR')} · {number(r.km)} km
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{money(r.totalAmount)}</p>
                  <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge>
                </div>
              </div>
            ))}
          </History>
        </div>
      </div>
    </DetailLayout>
  );
}

function DriverLotacaoSelector({
  driverId,
  currentId,
  secretarias,
  changed,
}: {
  driverId: number;
  currentId: number | null;
  secretarias: DriverDetail['secretarias'];
  changed: () => void;
}) {
  const [secretariaId, setSecretariaId] = useState(currentId ?? 0);
  useEffect(() => setSecretariaId(currentId ?? 0), [currentId]);
  const mutation = useMutation({
    mutationFn: () =>
      api(`/drivers/${driverId}`, {
        method: 'PATCH',
        body: JSON.stringify({ secretariaId }),
      }),
    onSuccess: changed,
  });

  return (
    <div className="mt-5 border-t border-slate-200 pt-4">
      <label htmlFor="motorista-lotacao">Alterar lotação</label>
      <select
        id="motorista-lotacao"
        className="mt-2"
        value={secretariaId}
        onChange={event => setSecretariaId(Number(event.target.value))}
      >
        <option value={0} disabled>
          Selecione uma secretaria
        </option>
        {secretarias.map(secretaria => (
          <option key={secretaria.id} value={secretaria.id}>
            {secretaria.sigla ? `${secretaria.sigla} — ` : ''}
            {secretaria.nome}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="mt-3 w-full rounded bg-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        disabled={!secretariaId || secretariaId === currentId || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? 'Salvando...' : 'Salvar nova lotação'}
      </button>
      {mutation.error && <p className="mt-2 text-xs text-red-700">{mutation.error.message}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
function History({
  title,
  icon,
  empty,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className="text-slate-500">{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="mt-3">
        {children.length ? (
          children
        ) : (
          <p className="border-t border-slate-200 py-4 text-sm text-slate-500">{empty}</p>
        )}
      </div>
    </Card>
  );
}
