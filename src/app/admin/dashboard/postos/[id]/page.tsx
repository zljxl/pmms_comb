import { StationDetails } from '@/components/station-details';

export default async function AdminStationDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StationDetails id={Number(id)} base="/admin/dashboard" />;
}
