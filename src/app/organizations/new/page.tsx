import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import NewOrgForm from './NewOrgForm';

export default async function NewOrganizationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirectTo=/organizations/new');

  return <NewOrgForm />;
}
