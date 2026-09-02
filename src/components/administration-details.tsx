'use client';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api, money, number } from '@/lib/api';
import { roleLabel } from '@/lib/status';
import { Badge, Button, Card } from './ui';
import { PasswordReset } from './password-reset';
import { DashboardDetailLayout } from './dashboard-detail-layout';
function Layout({
  title,
  back,
  children,
}: {
  title: string;
  back: string;
  children: React.ReactNode;
}) {
  return (
    <DashboardDetailLayout base={back.split('/').slice(0, 3).join('/')} back={back} title={title}>
      {children}
    </DashboardDetailLayout>
  );
}
export function SecretariaDetails({ id, base }: { id: number; base: string }) {
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ['secretaria', id],
    queryFn: () => api<any>(`/secretarias/${id}`),
  });
  if (!q.data)
    return (
      <Layout title="Secretaria" back={`${base}/secretarias`}>
        <Card>{q.error?.message || 'Carregando...'}</Card>
      </Layout>
    );
  const s = q.data,
    drivers = s.usuarios.filter((u: any) => u.role === 'DRIVER');
  return (
    <Layout title={s.nome} back={`${base}/secretarias`}>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <h2 className="text-sm font-semibold">Dados administrativos</h2>
          <dl className="mt-4 divide-y divide-slate-200">
            <Row label="Sigla" value={s.sigla || '—'} />
            <Row label="Situação" value={s.ativo ? 'Ativa' : 'Inativa'} />
            <Row label="Secretário" value={s.secretario?.nome || 'Não definido'} />
            <Row label="Matrícula" value={s.secretario?.matricula || '—'} />
          </dl>
          {s.canChangeSecretary && (
            <SecretarySelector
              secretariaId={id}
              currentId={s.secretario?.id}
              secretarios={s.secretarios}
              changed={() => queryClient.invalidateQueries({ queryKey: ['secretaria', id] })}
            />
          )}
        </Card>
        <Card>
          <h2 className="text-sm font-semibold">Estrutura vinculada</h2>
          <dl className="mt-4 divide-y divide-slate-200">
            <Row label="Usuários" value={String(s.usuarios.length)} />
            <Row label="Motoristas" value={String(drivers.length)} />
            <Row label="Veículos" value={String(s.veiculos.length)} />
            <Row label="Quotas registradas" value={String(s.quotas.length)} />
            <Row label="Abastecimentos recentes" value={String(s.refuelings.length)} />
          </dl>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold">Quota mais recente</h2>
          {s.quotas[0] ? (
            <dl className="mt-4 divide-y divide-slate-200">
              <Row
                label="Competência"
                value={`${String(s.quotas[0].month).padStart(2, '0')}/${s.quotas[0].year}`}
              />
              <Row label="Limite" value={money(s.quotas[0].amountLimit)} />
            </dl>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Nenhuma quota registrada.</p>
          )}
        </Card>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Motoristas</h2>
            <Badge tone={drivers.length ? 'green' : 'blue'}>{drivers.length}</Badge>
          </div>
          <div className="mt-4 divide-y divide-slate-200">
            {drivers.length ? (
              drivers.map((driver: any) => (
                <Link
                  key={driver.id}
                  href={`${base}/motoristas/${driver.id}`}
                  className="flex items-center justify-between gap-3 py-3 text-sm hover:text-blue"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{driver.nome}</p>
                    <p className="mt-0.5 font-mono text-xs text-slate-500">{driver.matricula}</p>
                  </div>
                  <Badge tone={driver.ativo ? 'green' : 'red'}>
                    {driver.ativo ? 'ATIVO' : 'INATIVO'}
                  </Badge>
                </Link>
              ))
            ) : (
              <p className="py-4 text-sm text-slate-500">
                Nenhum motorista vinculado à secretaria.
              </p>
            )}
          </div>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold">Veículos</h2>
          <div className="mt-4 divide-y divide-slate-200">
            {s.veiculos.map((v: any) => (
              <Link
                key={v.id}
                href={`${base}/veiculos/${v.id}`}
                className="flex justify-between py-3 text-sm hover:text-blue"
              >
                <span>
                  {v.marca} {v.modelo}
                </span>
                <span className="font-mono">{v.placa}</span>
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold">Abastecimentos recentes</h2>
          <div className="mt-4 divide-y divide-slate-200">
            {s.refuelings.map((r: any) => (
              <div key={r.id} className="flex justify-between gap-3 py-3 text-sm">
                <div>
                  <p>
                    {r.user.nome} · {r.vehicle.placa}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(r.createdAt).toLocaleDateString('pt-BR')} · {number(r.liters, 2)} L
                  </p>
                </div>
                <p className="font-semibold">{money(r.totalAmount)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  );
}

function SecretarySelector({
  secretariaId,
  currentId,
  secretarios,
  changed,
}: {
  secretariaId: number;
  currentId?: number;
  secretarios: Array<{ id: number; nome: string; matricula: string }>;
  changed: () => void;
}) {
  const [secretarioId, setSecretarioId] = useState(currentId ?? 0);
  useEffect(() => setSecretarioId(currentId ?? 0), [currentId]);
  const mutation = useMutation({
    mutationFn: () =>
      api(`/secretarias/${secretariaId}`, {
        method: 'PATCH',
        body: JSON.stringify({ secretarioId }),
      }),
    onSuccess: changed,
  });
  return (
    <div className="mt-5 border-t border-slate-200 pt-4">
      <label htmlFor="secretario-responsavel">Trocar secretário responsável</label>
      <select
        id="secretario-responsavel"
        className="mt-2"
        value={secretarioId}
        onChange={event => setSecretarioId(Number(event.target.value))}
      >
        <option value={0} disabled>
          Selecione um secretário
        </option>
        {secretarios.map(secretario => (
          <option key={secretario.id} value={secretario.id}>
            {secretario.nome} · {secretario.matricula}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="mt-3 w-full rounded bg-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        disabled={!secretarioId || secretarioId === currentId || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? 'Salvando...' : 'Salvar secretário'}
      </button>
      {mutation.error && <p className="mt-2 text-xs text-red-700">{mutation.error.message}</p>}
    </div>
  );
}
export function UserDetails({ id, base }: { id: number; base: string }) {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ['user', id], queryFn: () => api<any>(`/users/${id}`) });
  if (!q.data)
    return (
      <Layout title="Usuário" back={`${base}/usuarios`}>
        <Card>{q.error?.message || 'Carregando...'}</Card>
      </Layout>
    );
  const u = q.data;
  const statusMutation = useMutation({
    mutationFn: () =>
      api(`/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ativo: !u.ativo }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user', id] });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
  return (
    <Layout title={u.nome} back={`${base}/usuarios`}>
      <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
        <div className="space-y-5">
          <Card>
            <div className="flex justify-between">
              <h2 className="text-sm font-semibold">Dados do usuário</h2>
              <Badge tone={u.ativo ? 'green' : 'red'}>{u.ativo ? 'ATIVO' : 'INATIVO'}</Badge>
            </div>
            <dl className="mt-4 divide-y divide-slate-200">
              <Row label="Matrícula" value={u.matricula} />
              <Row label="Perfil" value={roleLabel(u.role)} />
              <Row label="Secretaria" value={u.secretaria?.nome || 'Não vinculada'} />
              <Row label="Cadastro" value={new Date(u.createdAt).toLocaleDateString('pt-BR')} />
            </dl>
            {u.canManageStatus && (
              <div className="mt-5 border-t border-slate-200 pt-4">
                <Button
                  busy={statusMutation.isPending}
                  onClick={() => statusMutation.mutate()}
                  className={
                    u.ativo
                      ? 'w-full bg-red-700 hover:bg-red-800'
                      : 'w-full bg-green-700 hover:bg-green-800'
                  }
                >
                  {u.ativo ? 'Desativar usuário' : 'Reativar usuário'}
                </Button>
                {statusMutation.error && (
                  <p className="mt-2 text-sm text-red-700">{statusMutation.error.message}</p>
                )}
              </div>
            )}
          </Card>
          <PasswordReset userId={u.id} allowed={u.canResetPassword} />
        </div>
        <Card>
          <h2 className="text-sm font-semibold">Atividades de auditoria</h2>
          <div className="mt-4 divide-y divide-slate-200">
            {u.auditLogs.length ? (
              u.auditLogs.map((log: any) => (
                <div key={log.id} className="py-3 text-sm">
                  <p className="font-medium">{log.action.replaceAll('_', ' ')}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(log.createdAt).toLocaleString('pt-BR')} · {log.entity}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Nenhuma atividade registrada.</p>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-3 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
