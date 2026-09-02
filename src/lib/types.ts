export type Role = 'DRIVER' | 'SECRETARY' | 'GOVERNMENT_SECRETARY' | 'MAYOR' | 'ADMIN';
export type User = {
  id: number;
  matricula: string;
  nome: string;
  role: Role;
  secretariaId: number | null;
  secretaria?: { id: number; nome: string; sigla: string | null } | null;
};
export type Vehicle = {
  id: number;
  placa: string;
  marca: string;
  modelo: string;
  fuelType?: string | null;
  currentKm: number;
  status: string;
  secretaria: { id: number; nome: string };
};
export type Session = { id: number; startKm: number; startedAt: string; vehicle: Vehicle };
export type Dashboard = {
  totals: {
    amount: number;
    liters: number;
    quota: number;
    pending: number;
    activeVehicles: number;
    vehicles: number;
  };
  activeSessions: Array<{
    id: number;
    startKm: number;
    startedAt: string;
    user: { id: number; nome: string; matricula: string };
    vehicle: Vehicle;
  }>;
  bySecretaria: { id: number; name: string; amount: number }[];
  recent: unknown[];
  analytics: {
    monthly: { label: string; amount: number; liters: number }[];
    statuses: { status: string; count: number }[];
    quotaUsage: { name: string; limit: number; spent: number }[];
    weekdays: { label: string; count: number; liters: number }[];
    hours: { label: string; count: number }[];
    topVehicles: { name: string; plate: string; liters: number; amount: number; count: number }[];
    topSecretarias: { name: string; liters: number; amount: number; count: number }[];
  };
};
export type SecretariaOption = { id: number; nome: string; sigla: string | null };
export type Driver = {
  id: number;
  nome: string;
  matricula: string;
  ativo: boolean;
  createdAt: string;
  secretaria: SecretariaOption | null;
};
export type DriversData = {
  drivers: Driver[];
  secretarias: SecretariaOption[];
  canCreate: boolean;
};
export type Secretaria = SecretariaOption & {
  ativo: boolean;
  _count: { usuarios: number; veiculos: number };
};
export type QuotasData = {
  year: number;
  month: number;
  canManage: boolean;
  generalQuota: number;
  allocated: number;
  items: Array<SecretariaOption & { ativo: boolean; amountLimit: number; quotaId: number | null }>;
};
export type UserRecord = {
  id: number;
  nome: string;
  matricula: string;
  role: Role;
  ativo: boolean;
  createdAt: string;
  secretaria: SecretariaOption | null;
  secretariasGerenciadas: SecretariaOption[];
};
export type GasStation = {
  id: number;
  name: string;
  legalName: string | null;
  cnpj: string | null;
  phone: string | null;
  contractNumber: string | null;
  address: string;
  latitude: number;
  longitude: number;
  gasolinePrice: number | null;
  ethanolPrice: number | null;
  dieselS10Price: number | null;
  dieselS500Price: number | null;
  active: boolean;
  createdAt: string;
};
