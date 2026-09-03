'use client';

import { useState } from 'react';
import Tabs, { type Tab } from './Tabs';
import Reveal from './Reveal';

/**
 * Generic tabbed layout: a Server Component renders each section (with
 * its own data + interactive children) and hands the finished JSX in as
 * a slot -- this just switches which one is visible, so pages don't need
 * to move their data fetching into a client component to get tabs.
 */
export default function SlotTabs({
  tabs,
  slots,
  defaultTab,
  layoutId,
}: {
  tabs: Tab[];
  slots: Record<string, React.ReactNode>;
  defaultTab?: string;
  layoutId?: string;
}) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);

  return (
    <div>
      <Tabs tabs={tabs} active={active} onChange={setActive} layoutId={layoutId} />
      <Reveal key={active}>{slots[active]}</Reveal>
    </div>
  );
}
