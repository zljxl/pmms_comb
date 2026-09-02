import { notFound } from 'next/navigation';
import DashboardPage from '../../../dashboard/page';

const sections = new Set([
  'abastecimentos',
  'veiculos',
  'motoristas',
  'usuarios',
  'secretarios',
  'secretarias',
  'postos',
  'quotas',
  'relatorios',
]);
export default async function SecretaryDashboardSection({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.has(section)) notFound();
  return <DashboardPage />;
}
