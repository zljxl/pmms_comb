import { notFound } from 'next/navigation';
import DashboardPage from '../../../dashboard/page';

const sections = new Set(['abastecimentos', 'postos']);
export default async function DriverDashboardSection({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.has(section)) notFound();
  return <DashboardPage />;
}
