import { notFound } from 'next/navigation';
import DashboardPage from '../page';

const validSections = new Set([
  'abastecimentos',
  'veiculos',
  'motoristas',
  'usuarios',
  'secretarias',
  'quotas',
  'afs',
  'relatorios',
]);

export default async function DashboardSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!validSections.has(section)) notFound();
  return <DashboardPage />;
}
