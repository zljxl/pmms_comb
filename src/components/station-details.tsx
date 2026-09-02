'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, money, number } from '@/lib/api';
import { LocationPicker } from './location-picker';
import { Badge, Button, Card } from './ui';
import { DashboardDetailLayout } from './dashboard-detail-layout';
import { TablePagination, useTablePagination } from './table-pagination';

type StationDetail = {
  id: number;
  name: string;
  legalName: string | null;
  cnpj: string | null;
  phone: string | null;
  contractNumber: string | null;
  address: string;
  latitude: number;
  longitude: number;
  active: boolean;
  gasolinePrice: number | null;
  ethanolPrice: number | null;
  dieselS10Price: number | null;
  dieselS500Price: number | null;
  canManage: boolean;
  allowances: Array<{ id: number; year: number; month: number; litersLimit: number }>;
  usageByMonth: Array<{ year: number; month: number; liters: number; amount: number }>;
  refuelings: Array<{
    id: number;
    externalCode: string | null;
    createdAt: string;
    liters: number;
    totalAmount: number;
    vehicle: { placa: string; marca: string; modelo: string };
    user: { nome: string; matricula: string };
    secretaria: { nome: string; sigla: string | null };
  }>;
};

export function StationDetails({ id, base }: { id: number; base: string }) {
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const query = useQuery({
    queryKey: ['station', id],
    queryFn: () => api<StationDetail>(`/stations/${id}`),
  });
  const refuelings = query.data?.refuelings ?? [];
  const pagination = useTablePagination(refuelings);
  if (!query.data)
    return (
      <DashboardDetailLayout base={base} back={`${base}/postos`} title="Fornecedor">
        <Card>{query.error?.message || 'Carregando fornecedor...'}</Card>
      </DashboardDetailLayout>
    );
  const station = query.data;
  return (
    <DashboardDetailLayout
      base={base}
      back={`${base}/postos`}
      title={station.name}
      subtitle={station.legalName || undefined}
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Dados do fornecedor</h2>
            <div className="flex items-center gap-2">
              <Badge tone={station.active ? 'green' : 'red'}>
                {station.active ? 'ATIVO' : 'INATIVO'}
              </Badge>
              {station.canManage && (
                <button
                  type="button"
                  onClick={() => setEditing(current => !current)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-blue hover:bg-slate-50"
                >
                  {editing ? 'Cancelar edição' : 'Editar posto'}
                </button>
              )}
            </div>
          </div>
          <dl className="mt-4 divide-y divide-slate-200">
            <Row label="CNPJ" value={formatCnpj(station.cnpj)} />
            <Row label="Telefone" value={station.phone || '—'} />
            <Row label="Contrato" value={station.contractNumber || '—'} />
            <Row label="Endereço" value={station.address} />
          </dl>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold">Preços vigentes</h2>
          <dl className="mt-4 divide-y divide-slate-200">
            <Row
              label="Gasolina"
              value={station.gasolinePrice ? `${money(station.gasolinePrice)}/L` : '—'}
            />
            <Row
              label="Etanol"
              value={station.ethanolPrice ? `${money(station.ethanolPrice)}/L` : '—'}
            />
            <Row
              label="Diesel S10"
              value={station.dieselS10Price ? `${money(station.dieselS10Price)}/L` : '—'}
            />
            <Row
              label="Diesel S500"
              value={station.dieselS500Price ? `${money(station.dieselS500Price)}/L` : '—'}
            />
          </dl>
        </Card>
        <AllowanceForm
          station={station}
          done={() => client.invalidateQueries({ queryKey: ['station', id] })}
        />
      </div>
      {editing && (
        <StationEditForm
          station={station}
          done={() => {
            setEditing(false);
            void client.invalidateQueries({ queryKey: ['station', id] });
            void client.invalidateQueries({ queryKey: ['stations'] });
          }}
        />
      )}
      <UsageChart items={station.usageByMonth} allowances={station.allowances} />
      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_2fr]">
        <Card>
          <h2 className="text-sm font-semibold">Histórico de limites</h2>
          <div className="mt-4 divide-y divide-slate-200">
            {station.allowances.length ? (
              station.allowances.map(item => {
                const usage =
                  station.usageByMonth.find(
                    value => value.year === item.year && value.month === item.month,
                  )?.liters || 0;
                return (
                  <div key={item.id} className="py-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <span>
                        {String(item.month).padStart(2, '0')}/{item.year}
                      </span>
                      <b>
                        {number(usage, 2)} de {number(item.litersLimit, 2)} L
                      </b>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-2 rounded-full bg-blue"
                        style={{
                          width: `${Math.min(100, item.litersLimit ? (usage / item.litersLimit) * 100 : 0)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">Nenhum limite registrado.</p>
            )}
          </div>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold">Histórico de abastecimentos</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b text-xs uppercase text-slate-500">
                <tr>
                  <th className="pb-3">Data</th>
                  <th className="pb-3">Motorista</th>
                  <th className="pb-3">Veículo</th>
                  <th className="pb-3">Secretaria</th>
                  <th className="pb-3 text-right">Litros</th>
                  <th className="pb-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {pagination.paginatedItems.map(item => (
                  <tr key={item.id} className="border-b border-slate-200">
                    <td className="py-3">{new Date(item.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td className="py-3">{item.user.nome}</td>
                    <td className="py-3 font-mono">{item.vehicle.placa}</td>
                    <td className="py-3">{item.secretaria.nome}</td>
                    <td className="py-3 text-right">{number(item.liters, 2)} L</td>
                    <td className="py-3 text-right font-semibold">{money(item.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePagination total={refuelings.length} {...pagination.paginationProps} />
            {!station.refuelings.length && (
              <p className="py-5 text-sm text-slate-500">
                Nenhum abastecimento registrado neste fornecedor.
              </p>
            )}
          </div>
        </Card>
      </div>
    </DashboardDetailLayout>
  );
}

function StationEditForm({ station, done }: { station: StationDetail; done: () => void }) {
  const [form, setForm] = useState({
    name: station.name,
    legalName: station.legalName || '',
    cnpj: station.cnpj || '',
    phone: station.phone || '',
    contractNumber: station.contractNumber || '',
    address: station.address,
    latitude: station.latitude,
    longitude: station.longitude,
    gasolinePrice: station.gasolinePrice || 0,
    ethanolPrice: station.ethanolPrice || 0,
    dieselS10Price: station.dieselS10Price || 0,
    dieselS500Price: station.dieselS500Price || 0,
    active: station.active,
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm(current => ({ ...current, [key]: value }));
  const mutation = useMutation({
    mutationFn: () =>
      api(`/stations/${station.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...form,
          gasolinePrice: form.gasolinePrice || undefined,
          ethanolPrice: form.ethanolPrice || undefined,
          dieselS10Price: form.dieselS10Price || undefined,
          dieselS500Price: form.dieselS500Price || undefined,
        }),
      }),
    onSuccess: done,
  });
  return (
    <Card className="mt-5">
      <div>
        <h2 className="text-base font-semibold">Editar posto credenciado</h2>
        <p className="mt-1 text-sm text-slate-600">
          Atualize os dados cadastrais, preços, localização e situação do fornecedor.
        </p>
      </div>
      <form
        className="mt-5"
        onSubmit={event => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <EditField
            label="Nome fantasia"
            value={form.name}
            set={value => set('name', value)}
            required
          />
          <EditField
            label="Razão social"
            value={form.legalName}
            set={value => set('legalName', value)}
            required
          />
          <EditField label="CNPJ" value={form.cnpj} set={value => set('cnpj', value)} required />
          <EditField label="Telefone" value={form.phone} set={value => set('phone', value)} />
          <EditField
            label="Contrato"
            value={form.contractNumber}
            set={value => set('contractNumber', value)}
          />
          <EditField
            label="Endereço"
            value={form.address}
            set={value => set('address', value)}
            required
          />
          <EditNumber
            label="Gasolina (R$/L)"
            value={form.gasolinePrice}
            set={value => set('gasolinePrice', value)}
          />
          <EditNumber
            label="Etanol (R$/L)"
            value={form.ethanolPrice}
            set={value => set('ethanolPrice', value)}
          />
          <EditNumber
            label="Diesel S10 (R$/L)"
            value={form.dieselS10Price}
            set={value => set('dieselS10Price', value)}
          />
          <EditNumber
            label="Diesel S500 (R$/L)"
            value={form.dieselS500Price}
            set={value => set('dieselS500Price', value)}
          />
        </div>
        <div className="mt-5">
          <label>Localização do posto</label>
          <LocationPicker
            latitude={form.latitude}
            longitude={form.longitude}
            onChange={point => setForm(current => ({ ...current, ...point }))}
          />
        </div>
        <label className="mt-5 flex items-center gap-3 normal-case tracking-normal">
          <input
            type="checkbox"
            checked={form.active}
            onChange={event => set('active', event.target.checked)}
            className="h-4 w-4"
          />
          Posto ativo e disponível para abastecimentos
        </label>
        {mutation.error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {mutation.error.message}
          </p>
        )}
        <div className="mt-5 flex justify-end">
          <Button busy={mutation.isPending}>Salvar alterações</Button>
        </div>
      </form>
    </Card>
  );
}

function EditField({
  label,
  value,
  set,
  required = false,
}: {
  label: string;
  value: string;
  set: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label>{label}</label>
      <input value={value} onChange={event => set(event.target.value)} required={required} />
    </div>
  );
}

function EditNumber({
  label,
  value,
  set,
}: {
  label: string;
  value: number;
  set: (value: number) => void;
}) {
  return (
    <div>
      <label>{label}</label>
      <input
        type="number"
        min="0"
        step="0.001"
        value={value || ''}
        onChange={event => set(Number(event.target.value))}
      />
    </div>
  );
}

function AllowanceForm({ station, done }: { station: StationDetail; done: () => void }) {
  const now = new Date(),
    [month, setMonth] = useState(now.getMonth() + 1),
    [year, setYear] = useState(now.getFullYear()),
    [litersLimit, setLitersLimit] = useState(0);
  const mutation = useMutation({
    mutationFn: () =>
      api(`/stations/${station.id}/allowances`, {
        method: 'POST',
        body: JSON.stringify({ month, year, litersLimit }),
      }),
    onSuccess: done,
  });
  if (!station.canManage)
    return (
      <Card>
        <h2 className="text-sm font-semibold">Limite mensal</h2>
        <p className="mt-4 text-sm text-slate-500">
          Consulte o histórico de litros liberados abaixo.
        </p>
      </Card>
    );
  return (
    <Card>
      <h2 className="text-sm font-semibold">Definir litros liberados</h2>
      <form
        className="mt-4"
        onSubmit={event => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label>Mês</label>
            <select value={month} onChange={event => setMonth(Number(event.target.value))}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map(value => (
                <option key={value} value={value}>
                  {String(value).padStart(2, '0')}
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
              value={year}
              onChange={event => setYear(Number(event.target.value))}
            />
          </div>
        </div>
        <div className="mt-3">
          <label>Limite de litros</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={litersLimit || ''}
            onChange={event => setLitersLimit(Number(event.target.value))}
            required
          />
        </div>
        {mutation.error && <p className="mt-3 text-sm text-red-700">{mutation.error.message}</p>}
        <Button busy={mutation.isPending} disabled={!litersLimit} className="mt-4 w-full">
          Salvar competência
        </Button>
      </form>
    </Card>
  );
}

function UsageChart({
  items,
  allowances,
}: {
  items: StationDetail['usageByMonth'];
  allowances: StationDetail['allowances'];
}) {
  const recent = items.slice(0, 12).reverse(),
    max = Math.max(1, ...recent.map(item => item.liters));
  return (
    <Card className="mt-5">
      <h2 className="text-sm font-semibold">Consumo mensal no fornecedor</h2>
      <p className="mt-1 text-xs text-slate-500">
        Litros abastecidos e limite liberado por competência.
      </p>
      <div className="mt-6 flex h-52 items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 pt-4">
        {recent.length ? (
          recent.map(item => {
            const limit = allowances.find(
              value => value.year === item.year && value.month === item.month,
            )?.litersLimit;
            return (
              <div
                key={`${item.year}-${item.month}`}
                className="flex h-full min-w-0 flex-1 flex-col justify-end"
              >
                <p className="mb-1 text-center text-[10px] font-semibold">
                  {number(item.liters, 0)} L
                </p>
                <div
                  className={`mx-auto w-full max-w-14 rounded-t-xl ${limit && item.liters > limit ? 'bg-red-700' : 'bg-blue'}`}
                  style={{ height: `${Math.max(5, (item.liters / max) * 78)}%` }}
                />
                <p className="py-2 text-center text-[10px] text-slate-500">
                  {String(item.month).padStart(2, '0')}/{String(item.year).slice(-2)}
                </p>
              </div>
            );
          })
        ) : (
          <p className="m-auto text-sm text-slate-500">Ainda não há consumo registrado.</p>
        )}
      </div>
    </Card>
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
function formatCnpj(value: string | null) {
  if (!value) return '—';
  const digits = value.replace(/\D/g, '');
  return digits.length === 14
    ? digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    : value;
}
