import { StationDetails } from '@/components/station-details';

export default async function SecretaryStationDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StationDetails id={Number(id)} base="/secretary/dashboard" />;
}
