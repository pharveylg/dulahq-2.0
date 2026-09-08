'use server';

import { createClient } from '@/lib/supabase/server';

export type NotificationRow = {
  id: string;
  template: string;
  payload: { title?: string; body?: string } & Record<string, unknown>;
  link_path: string | null;
  created_at: string;
  read_at: string | null;
};

/**
 * RLS (notifications_read_own, phase4) already scopes this to rows the
 * caller may see -- their own recipient_user_id, or via a guardian row
 * whose user_id matches them -- so no explicit filter is needed here.
 */
export async function getMyNotifications(limit = 20): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('notifications')
    .select('id, template, payload, link_path, created_at, read_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as NotificationRow[];
}

export async function markNotificationRead(id: string) {
  const supabase = await createClient();
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
}
