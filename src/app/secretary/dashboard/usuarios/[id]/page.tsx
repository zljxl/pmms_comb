import { UserDetails } from '@/components/administration-details';

export default async function SecretaryUserDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <UserDetails id={Number(id)} base="/secretary/dashboard" />;
}
