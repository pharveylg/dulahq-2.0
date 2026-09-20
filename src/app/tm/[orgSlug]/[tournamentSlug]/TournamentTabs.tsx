'use client';

import { useState } from 'react';
import Tabs, { type Tab } from '@/components/motion/Tabs';
import Reveal from '@/components/motion/Reveal';

export default function TournamentTabs({
  pendingCount,
  categoryCount,
  financeBadge,
  entriesSlot,
  categoriesSlot,
  financeSlot,
  staffSlot,
}: {
  pendingCount: number;
  categoryCount: number;
  financeBadge: number;
  entriesSlot: React.ReactNode;
  categoriesSlot: React.ReactNode;
  financeSlot: React.ReactNode | null;
  staffSlot: React.ReactNode | null;
}) {
  const tabs: Tab[] = [
    { id: 'entries', label: 'Entries', badge: pendingCount },
    { id: 'categories', label: 'Categories', badge: categoryCount },
    ...(financeSlot ? [{ id: 'finance', label: 'Finance', badge: financeBadge }] : []),
    ...(staffSlot ? [{ id: 'staff', label: 'Staff' }] : []),
  ];
  const [active, setActive] = useState('entries');

  return (
    <div>
      <Tabs tabs={tabs} active={active} onChange={setActive} layoutId="tournament-console-tabs" />
      <Reveal key={active}>
        {active === 'entries' && entriesSlot}
        {active === 'categories' && categoriesSlot}
        {active === 'finance' && financeSlot}
        {active === 'staff' && staffSlot}
      </Reveal>
    </div>
  );
}
