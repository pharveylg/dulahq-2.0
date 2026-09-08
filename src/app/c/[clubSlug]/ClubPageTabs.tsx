'use client';

import { useState } from 'react';
import Tabs, { type Tab } from '@/components/motion/Tabs';
import Reveal from '@/components/motion/Reveal';

export default function ClubPageTabs({
  hasDashboard,
  counts,
  dashboardSlot,
  teamsSlot,
  staffSlot,
  tripsSlot,
  announcementsSlot,
  photosSlot,
  financesSlot,
  reportsSlot,
  meetingsSlot,
}: {
  hasDashboard: boolean;
  counts: { teams: number; staff: number; trips: number; announcements: number; photos: number; meetings: number };
  dashboardSlot: React.ReactNode;
  teamsSlot: React.ReactNode;
  staffSlot: React.ReactNode;
  tripsSlot: React.ReactNode;
  announcementsSlot: React.ReactNode;
  photosSlot: React.ReactNode;
  financesSlot: React.ReactNode | null;
  reportsSlot: React.ReactNode | null;
  meetingsSlot: React.ReactNode | null;
}) {
  const tabs: Tab[] = [
    ...(hasDashboard ? [{ id: 'overview', label: 'Overview' }] : []),
    { id: 'teams', label: 'Teams', badge: counts.teams },
    { id: 'staff', label: 'Staff', badge: counts.staff },
    ...(financesSlot ? [{ id: 'finances', label: 'Finances' }] : []),
    ...(reportsSlot ? [{ id: 'reports', label: 'Reports' }] : []),
    { id: 'meetings', label: 'Meetings', badge: counts.meetings },
    { id: 'trips', label: 'Trips', badge: counts.trips },
    { id: 'announcements', label: 'Announcements', badge: counts.announcements },
    { id: 'photos', label: 'Photos', badge: counts.photos },
  ];
  const [active, setActive] = useState(hasDashboard ? 'overview' : 'teams');

  return (
    <div>
      <Tabs tabs={tabs} active={active} onChange={setActive} layoutId="club-page-tabs" />
      <Reveal key={active}>
        {active === 'overview' && dashboardSlot}
        {active === 'teams' && teamsSlot}
        {active === 'staff' && staffSlot}
        {active === 'finances' && financesSlot}
        {active === 'reports' && reportsSlot}
        {active === 'meetings' && meetingsSlot}
        {active === 'trips' && tripsSlot}
        {active === 'announcements' && announcementsSlot}
        {active === 'photos' && photosSlot}
      </Reveal>
    </div>
  );
}
