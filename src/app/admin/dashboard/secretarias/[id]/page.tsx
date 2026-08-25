import { SecretariaDetails } from '@/components/administration-details';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <SecretariaDetails id={Number((await params).id)} base="/admin/dashboard" />;
}
