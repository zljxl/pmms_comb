const labels: Record<string, string> = {
  WAITING_SECRETARY: 'AGUARDANDO O SECRETÁRIO',
  WAITING_GOVERNMENT: 'AGUARDANDO O SECRETÁRIO DE GOVERNO',
  WAITING_MAYOR: 'AGUARDANDO O PREFEITO',
  APPROVED: 'APROVADO',
  REJECTED: 'REJEITADO',
  RETURNED: 'DEVOLVIDO PARA RETIFICAÇÃO',
  AVAILABLE: 'DISPONÍVEL',
  IN_USE: 'EM USO',
  MAINTENANCE: 'EM MANUTENÇÃO',
  INACTIVE: 'INATIVO',
  ACTIVE: 'ATIVO',
  FINISHED: 'ENCERRADO',
  CANCELLED: 'CANCELADO',
};

export function statusLabel(status: string) {
  return labels[status] ?? status.replaceAll('_', ' ');
}

const roleLabels: Record<string, string> = {
  DRIVER: 'MOTORISTA',
  SECRETARY: 'SECRETÁRIO',
  GOVERNMENT_SECRETARY: 'SECRETÁRIO DE GOVERNO',
  MAYOR: 'PREFEITO',
  ADMIN: 'ADMINISTRADOR',
};

export function roleLabel(role: string) {
  return roleLabels[role] ?? role.replaceAll('_', ' ');
}

const timelineLabels: Record<string, string> = {
  REGISTROU_ABASTECIMENTO: 'ABASTECIMENTO REGISTRADO',
  APPROVED_ABASTECIMENTO: 'ABASTECIMENTO APROVADO',
  REJECTED_ABASTECIMENTO: 'ABASTECIMENTO REJEITADO',
  RETURNED_ABASTECIMENTO: 'DEVOLVIDO PARA RETIFICAÇÃO',
  RETIFICOU_ABASTECIMENTO: 'ABASTECIMENTO RETIFICADO',
  GEROU_CUPOM_ABASTECIMENTO: 'COMPROVANTE PDF GERADO',
};

export function timelineActionLabel(action: string) {
  return timelineLabels[action] ?? statusLabel(action);
}

const fuelLabels: Record<string, string> = {
  GASOLINE: 'GASOLINA',
  GASOLINA: 'GASOLINA',
  ETHANOL: 'ETANOL',
  ETANOL: 'ETANOL',
  DIESEL: 'DIESEL S10',
  DIESEL_S10: 'DIESEL S10',
  'DIESEL S10': 'DIESEL S10',
  DIESEL_S500: 'DIESEL S500',
  'DIESEL S500': 'DIESEL S500',
  FLEX: 'FLEX',
  ELECTRIC: 'ELÉTRICO',
  ELETRICO: 'ELÉTRICO',
  HYBRID: 'HÍBRIDO',
  HIBRIDO: 'HÍBRIDO',
};

export function fuelLabel(fuelType?: string | null) {
  if (!fuelType) return '—';
  const normalized = fuelType.trim().toUpperCase();
  return fuelLabels[normalized] ?? normalized.replaceAll('_', ' ');
}
