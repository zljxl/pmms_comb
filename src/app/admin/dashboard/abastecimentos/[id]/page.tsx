import { RefuelingDetails } from '@/components/refueling-details';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <RefuelingDetails id={Number((await params).id)} base="/admin/dashboard" />;
}
