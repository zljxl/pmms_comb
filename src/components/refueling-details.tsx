'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock3, Download, FileText, ImageOff, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, money, number, uploadImage } from '@/lib/api';
import { statusLabel } from '@/lib/status';
import { User } from '@/lib/types';
import { Badge, Button, Card } from './ui';
import { DashboardDetailLayout } from './dashboard-detail-layout';
type Detail = {
  id: number;
  createdAt: string;
  km: number;
  liters: number;
  pricePerLiter: number;
  totalAmount: number;
  fuelType: string;
  fuelStation: string | null;
  status: string;
  observation: string | null;
  pumpPhoto: string | null;
  odometerPhoto: string | null;
  receiptPhoto: string | null;
  voucherPdf: string | null;
  externalCode: string | null;
  vehicle: { placa: string; marca: string; modelo: string };
  user: { nome: string; matricula: string };
  secretaria: { nome: string };
  timeline: {
    type: string;
    label: string;
    date: string;
    user: string;
    observation: string | null;
    attachment: string | null;
  }[];
};
export function RefuelingDetails({ id, base }: { id: number; base: string }) {
  const client = useQueryClient(),
    [user, setUser] = useState<User | null>(null),
    query = useQuery({
      queryKey: ['refueling', id],
      queryFn: () => api<Detail>(`/refuelings/${id}`),
    });
  useEffect(() => {
    const value = localStorage.getItem('user');
    if (value) setUser(JSON.parse(value) as User);
  }, []);
  if (!query.data)
    return (
      <Layout back={`${base}/abastecimentos`}>
        <Card>{query.error?.message || 'Carregando abastecimento...'}</Card>
      </Layout>
    );
  const item = query.data;
  return (
    <Layout back={`${base}/abastecimentos`}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500">Abastecimento #{item.id}</p>
          <h1 className="mt-1 text-2xl font-semibold">
            {item.vehicle.marca} {item.vehicle.modelo} · {item.vehicle.placa}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {item.user.nome} · {new Date(item.createdAt).toLocaleString('pt-BR')}
          </p>
        </div>
        <Badge
          tone={
            item.status === 'APPROVED' ? 'green' : item.status === 'REJECTED' ? 'red' : 'yellow'
          }
        >
          {statusLabel(item.status)}
        </Badge>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-5">
          <Card>
            <h2 className="text-sm font-semibold">Dados do abastecimento</h2>
            <dl className="mt-4 divide-y divide-slate-200">
              <Row label="Secretaria" value={item.secretaria.nome} />
              <Row label="Posto" value={item.fuelStation || '—'} />
              <Row label="Quilometragem" value={`${number(item.km)} km`} />
              <Row label="Litros" value={`${number(item.liters, 2)} L`} />
              <Row label="Valor por litro" value={money(item.pricePerLiter)} />
              <Row label="Total" value={money(item.totalAmount)} />
            </dl>
          </Card>
          {item.voucherPdf && (
            <VoucherActions url={item.voucherPdf} code={item.externalCode || `ABAST-${item.id}`} />
          )}
          <Card>
            <h2 className="text-sm font-semibold">Evidências</h2>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Evidence label="Comprovante" url={item.receiptPhoto} />
              <Evidence label="Bomba" url={item.pumpPhoto} />
              <Evidence label="Hodômetro" url={item.odometerPhoto} />
            </div>
          </Card>
          {user?.role === 'DRIVER' && item.status === 'RETURNED' && (
            <Rectification
              item={item}
              done={() => client.invalidateQueries({ queryKey: ['refueling', id] })}
            />
          )}
          {user && user.role !== 'DRIVER' && (
            <DecisionPanel
              id={item.id}
              status={item.status}
              user={user}
              done={() => client.invalidateQueries({ queryKey: ['refueling', id] })}
            />
          )}
        </div>
        <Card>
          <h2 className="text-sm font-semibold">Timeline do abastecimento</h2>
          <ol className="mt-5 border-l-2 border-slate-200 pl-6">
            {item.timeline.map((event, index) => (
              <li key={`${event.type}-${event.date}-${index}`} className="relative pb-6 last:pb-0">
                <span className="absolute -left-[33px] top-0 grid h-4 w-4 place-items-center rounded-full bg-white ring-2 ring-blue">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue" />
                </span>
                <p className="text-sm font-semibold">{event.label}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(event.date).toLocaleString('pt-BR')} · {event.user}
                </p>
                {event.observation && (
                  <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                    {event.observation}
                  </p>
                )}
                {event.attachment && (
                  <a
                    href={event.attachment}
                    download
                    className="mt-3 inline-flex items-center gap-2 rounded-xl border border-blue/30 bg-blue/5 px-3 py-2 text-xs font-semibold text-blue hover:bg-blue/10"
                  >
                    <FileText size={15} />
                    Baixar comprovante vinculado
                  </a>
                )}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </Layout>
  );
}

function VoucherActions({ url, code }: { url: string; code: string }) {
  async function share() {
    const absoluteUrl = new URL(url, window.location.origin).toString();
    if (navigator.share) {
      await navigator.share({
        title: `Comprovante ${code}`,
        text: `Comprovante do abastecimento ${code}`,
        url: absoluteUrl,
      });
      return;
    }
    await navigator.clipboard.writeText(absoluteUrl);
    window.alert('Link do comprovante copiado.');
  }
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue/10 text-blue">
          <FileText size={20} />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Cupom do abastecimento</h2>
          <p className="mt-1 text-xs text-slate-500">
            Documento PDF oficial vinculado ao processo {code}.
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <a
          href={url}
          download={`${code}.pdf`}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue px-4 py-2.5 text-sm font-semibold text-white hover:brightness-95"
        >
          <Download size={17} />
          Baixar PDF
        </a>
        <Button
          onClick={() => void share()}
          className="border border-slate-300 bg-white text-navy hover:bg-slate-100"
        >
          <Share2 size={17} />
          Enviar
        </Button>
      </div>
    </Card>
  );
}

function DecisionPanel({
  id,
  status,
  user,
  done,
}: {
  id: number;
  status: string;
  user: User;
  done: () => void;
}) {
  const [observation, setObservation] = useState('');
  const expected =
    user.role === 'SECRETARY'
      ? 'WAITING_SECRETARY'
      : user.role === 'GOVERNMENT_SECRETARY' || user.role === 'MAYOR'
        ? 'WAITING_GOVERNMENT'
        : '';
  const canDecide =
    status === expected ||
    ((user.role === 'GOVERNMENT_SECRETARY' || user.role === 'MAYOR') && status === 'WAITING_MAYOR');
  const mutation = useMutation({
    mutationFn: (action: 'APPROVED' | 'REJECTED' | 'RETURNED') =>
      api(`/refuelings/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ action, observation: observation.trim() || undefined }),
      }),
    onSuccess: () => {
      setObservation('');
      done();
    },
  });

  if (!canDecide) {
    return (
      <Card>
        <h2 className="text-sm font-semibold">Tramitação do processo</h2>
        <p className="mt-2 text-sm text-slate-600">
          Este processo não está aguardando uma decisão do seu perfil neste momento.
        </p>
      </Card>
    );
  }

  function decide(action: 'APPROVED' | 'REJECTED' | 'RETURNED') {
    if (action !== 'APPROVED' && !observation.trim()) return;
    mutation.mutate(action);
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold">Tramitação do processo</h2>
      <p className="mt-1 text-xs text-slate-500">
        Analise os dados, as evidências e a timeline antes de registrar sua decisão.
      </p>
      <div className="mt-4">
        <label>Fundamentação da decisão</label>
        <textarea
          rows={4}
          value={observation}
          onChange={event => setObservation(event.target.value)}
          placeholder="Obrigatória para devolver ou rejeitar o processo"
        />
      </div>
      {mutation.error && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {mutation.error.message}
        </p>
      )}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Button busy={mutation.isPending} onClick={() => decide('APPROVED')}>
          Aprovar
        </Button>
        <Button
          disabled={mutation.isPending || !observation.trim()}
          onClick={() => decide('RETURNED')}
          className="border border-amber-300 bg-white text-amber-800 hover:bg-amber-50"
        >
          Devolver
        </Button>
        <Button
          disabled={mutation.isPending || !observation.trim()}
          onClick={() => decide('REJECTED')}
          className="border border-red-300 bg-white text-red-800 hover:bg-red-50"
        >
          Rejeitar
        </Button>
      </div>
    </Card>
  );
}

function Rectification({ item, done }: { item: Detail; done: () => void }) {
  const [km, setKm] = useState(item.km),
    [liters, setLiters] = useState(item.liters),
    [price, setPrice] = useState(item.pricePerLiter),
    [station, setStation] = useState(item.fuelStation ?? ''),
    [receipt, setReceipt] = useState<File | null>(null),
    [pump, setPump] = useState<File | null>(null),
    [odometer, setOdometer] = useState<File | null>(null);
  const mutation = useMutation({
    mutationFn: async () => {
      const [receiptPhoto, pumpPhoto, odometerPhoto] = await Promise.all([
        receipt ? uploadImage(receipt) : null,
        pump ? uploadImage(pump) : null,
        odometer ? uploadImage(odometer) : null,
      ]);
      return api(`/refuelings/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          km,
          liters,
          pricePerLiter: price,
          fuelStation: station,
          receiptPhoto: receiptPhoto?.url,
          pumpPhoto: pumpPhoto?.url,
          odometerPhoto: odometerPhoto?.url,
        }),
      });
    },
    onSuccess: done,
  });
  return (
    <Card>
      <h2 className="text-sm font-semibold">Retificar e reenviar</h2>
      <p className="mt-1 text-xs text-slate-500">
        Corrija os dados indicados na devolução. Novas fotos são opcionais.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label>KM</label>
          <input type="number" value={km} onChange={e => setKm(Number(e.target.value))} />
        </div>
        <div>
          <label>Litros</label>
          <input
            type="number"
            step=".01"
            value={liters}
            onChange={e => setLiters(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="mt-3">
        <label>Valor por litro</label>
        <input
          type="number"
          step=".01"
          value={price}
          onChange={e => setPrice(Number(e.target.value))}
        />
      </div>
      <div className="mt-3">
        <label>Posto</label>
        <input value={station} onChange={e => setStation(e.target.value)} />
      </div>
      <div className="mt-4 space-y-3">
        <FileInput label="Novo comprovante" set={setReceipt} />
        <FileInput label="Nova foto da bomba" set={setPump} />
        <FileInput label="Nova foto do hodômetro" set={setOdometer} />
      </div>
      {mutation.error && <p className="mt-3 text-sm text-red-700">{mutation.error.message}</p>}
      <Button busy={mutation.isPending} onClick={() => mutation.mutate()} className="mt-5 w-full">
        Salvar e reenviar
      </Button>
    </Card>
  );
}
function Layout({ back, children }: { back: string; children: React.ReactNode }) {
  return (
    <DashboardDetailLayout base={back.split('/').slice(0, 3).join('/')} back={back}>
      {children}
    </DashboardDetailLayout>
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
function Evidence({ label, url }: { label: string; url: string | null }) {
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
    >
      <img src={url} alt={label} className="aspect-square w-full object-cover" />
      <span className="block bg-white px-3 py-2 text-center text-xs font-semibold text-blue group-hover:underline">
        {label}
      </span>
    </a>
  ) : (
    <div className="grid aspect-square place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs text-slate-400">
      <div>
        <ImageOff className="mx-auto mb-2" size={24} />
        <span className="font-medium">{label}</span>
        <br />
        Imagem não enviada
      </div>
    </div>
  );
}
function FileInput({ label, set }: { label: string; set: (file: File | null) => void }) {
  return (
    <div>
      <label>{label}</label>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={e => set(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
