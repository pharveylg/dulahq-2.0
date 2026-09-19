'use client';

import { useState } from 'react';
import Tabs, { type Tab } from '@/components/motion/Tabs';
import Reveal from '@/components/motion/Reveal';

export default function TournamentTabs({
  pendingCount,
  categoryCount,
  entriesSlot,
  categoriesSlot,
  staffSlot,
}: {
  pendingCount: number;
  categoryCount: number;
  entriesSlot: React.ReactNode;
  categoriesSlot: React.ReactNode;
  staffSlot: React.ReactNode | null;
}) {
  const tabs: Tab[] = [
    { id: 'entries', label: 'Entries', badge: pendingCount },
    { id: 'categories', label: 'Categories', badge: categoryCount },
    ...(staffSlot ? [{ id: 'staff', label: 'Staff' }] : []),
  ];
  const [active, setActive] = useState('entries');

  return (
    <div>
      <Tabs tabs={tabs} active={active} onChange={setActive} layoutId="tournament-console-tabs" />
      <Reveal key={active}>
        {active === 'entries' && entriesSlot}
        {active === 'categories' && categoriesSlot}
        {active === 'staff' && staffSlot}
      </Reveal>
    </div>
  );
}
