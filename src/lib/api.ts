const BASE = '/api';
export function token() {
  return typeof window === 'undefined' ? null : localStorage.getItem('token');
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(!(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));

    if (response.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/') window.location.replace('/');
    }

    throw new Error(
      Array.isArray(body.message)
        ? body.message.join(', ')
        : (body.message ?? 'Não foi possível concluir a operação.'),
    );
  }
  return response.json();
}
export async function uploadImage(file: File) {
  const body = new FormData();
  body.append('file', file);
  return api<{ url: string }>('/uploads', { method: 'POST', body });
}
export const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
export const number = (value: number, digits = 0) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(value);
