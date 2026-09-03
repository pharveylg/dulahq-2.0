'use client';

import { useState } from 'react';
import Tabs from '@/components/motion/Tabs';
import VerticalTabList from '@/components/motion/VerticalTabList';
import Reveal from '@/components/motion/Reveal';
import AddPlayerForm from './AddPlayerForm';
import PlayerDetailPanel from './PlayerDetailPanel';
import TrainingSessions from './TrainingSessions';

type Player = Parameters<typeof PlayerDetailPanel>[0]['player'];
type Session = Parameters<typeof TrainingSessions>[0]['sessions'][number];

const TOP_TABS = [
  { id: 'roster', label: 'Roster' },
  { id: 'training', label: 'Training' },
];

export default function TeamRosterTabs({
  clubId,
  teamId,
  clubSlug,
  teamSlug,
  players,
  sessions,
  canManage,
}: {
  clubId: string;
  teamId: string;
  clubSlug: string;
  teamSlug: string;
  players: Player[];
  sessions: Session[];
  canManage: boolean;
}) {
  const [topTab, setTopTab] = useState('roster');
  const [selectedPlayerId, setSelectedPlayerId] = useState(players[0]?.id ?? '');
  const selectedPlayer = players.find((p) => p.id === selectedPlayerId) ?? players[0];

  return (
    <div>
      <Tabs
        tabs={TOP_TABS.map((t) => t.id === 'training' ? { ...t, badge: sessions.filter((s) => s.status === 'scheduled').length } : t)}
        active={topTab}
        onChange={setTopTab}
        layoutId="team-top-tabs"
      />

      {topTab === 'roster' && (
        <>
          {players.length === 0 ? (
            <div className="card empty-state">
              <p>No players yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ width: 220, flexShrink: 0 }}>
                <VerticalTabList
                  items={players.map((p) => ({
                    id: p.id,
                    title: p.name,
                    meta: [p.jersey && `#${p.jersey}`, p.position].filter(Boolean).join(' · ') || undefined,
                  }))}
                  active={selectedPlayerId || players[0]?.id}
                  onChange={setSelectedPlayerId}
                />
              </div>
              <div style={{ flex: 1, minWidth: 280 }}>
                {selectedPlayer && (
                  <Reveal key={selectedPlayer.id}>
                    <PlayerDetailPanel
                      clubId={clubId}
                      teamId={teamId}
                      clubSlug={clubSlug}
                      teamSlug={teamSlug}
                      player={selectedPlayer}
                      canManage={canManage}
                    />
                  </Reveal>
                )}
              </div>
            </div>
          )}
          {canManage && <AddPlayerForm clubId={clubId} teamId={teamId} />}
        </>
      )}

      {topTab === 'training' && (
        <TrainingSessions clubId={clubId} teamId={teamId} clubSlug={clubSlug} teamSlug={teamSlug} sessions={sessions} canManage={canManage} />
      )}
    </div>
  );
}
