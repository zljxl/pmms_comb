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
  contractLitersLimit: number;
  contractLitersUsed: number;
  contractLitersRemaining: number;
  canManage: boolean;
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
        <ContractQuotaCard station={station} />
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
      <div className="mt-5">
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
    contractLitersLimit: station.contractLitersLimit,
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
          <EditNumber
            label="Quota total do contrato (L)"
            value={form.contractLitersLimit}
            set={value => set('contractLitersLimit', value)}
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

function ContractQuotaCard({ station }: { station: StationDetail }) {
  const percentage = station.contractLitersLimit
    ? Math.min(100, (station.contractLitersUsed / station.contractLitersLimit) * 100)
    : 0;
  return (
    <Card>
      <h2 className="text-sm font-semibold">Quota do contrato</h2>
      <dl className="mt-4 divide-y divide-slate-200">
        <Row label="Total contratado" value={`${number(station.contractLitersLimit, 2)} L`} />
        <Row label="Consumido" value={`${number(station.contractLitersUsed, 2)} L`} />
        <Row label="Saldo disponível" value={`${number(station.contractLitersRemaining, 2)} L`} />
      </dl>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-2 rounded-full bg-blue" style={{ width: `${percentage}%` }} />
      </div>
      <p className="mt-2 text-right text-xs text-slate-500">{number(percentage, 1)}% utilizado</p>
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
