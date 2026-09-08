'use client';

import { useState } from 'react';
import Tabs from '@/components/motion/Tabs';
import VerticalTabList from '@/components/motion/VerticalTabList';
import Reveal from '@/components/motion/Reveal';
import AddPlayerForm from './AddPlayerForm';
import PlayerDetailPanel from './PlayerDetailPanel';
import TrainingSessions from './TrainingSessions';
import TeamTournaments from './TeamTournaments';

type Player = Parameters<typeof PlayerDetailPanel>[0]['player'];
type Session = Parameters<typeof TrainingSessions>[0]['sessions'][number];
type Entry = Parameters<typeof TeamTournaments>[0]['entries'][number];

const TOP_TABS = [
  { id: 'roster', label: 'Roster' },
  { id: 'training', label: 'Training' },
  { id: 'tournaments', label: 'Tournaments' },
];

export default function TeamRosterTabs({
  clubId,
  teamId,
  clubSlug,
  teamSlug,
  players,
  sessions,
  entries,
  canManage,
  canManageFees,
}: {
  clubId: string;
  teamId: string;
  clubSlug: string;
  teamSlug: string;
  players: Player[];
  sessions: Session[];
  entries: Entry[];
  canManage: boolean;
  canManageFees: boolean;
}) {
  const [topTab, setTopTab] = useState('roster');
  const [selectedPlayerId, setSelectedPlayerId] = useState(players[0]?.id ?? '');
  const selectedPlayer = players.find((p) => p.id === selectedPlayerId) ?? players[0];

  return (
    <div>
      <Tabs
        tabs={TOP_TABS.map((t) => {
          if (t.id === 'training') return { ...t, badge: sessions.filter((s) => s.status === 'scheduled').length };
          if (t.id === 'tournaments') return { ...t, badge: entries.length };
          return t;
        })}
        active={topTab}
        onChange={setTopTab}
        layoutId="team-top-tabs"
      />

      {topTab === 'roster' && (
        <>
          {canManage && <AddPlayerForm clubId={clubId} teamId={teamId} />}
          {players.length === 0 ? (
            <div className="card empty-state" style={{ marginTop: canManage ? 16 : 0 }}>
              <p>No players yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: canManage ? 16 : 0 }}>
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
                      canManageFees={canManageFees}
                    />
                  </Reveal>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {topTab === 'training' && (
        <TrainingSessions clubId={clubId} teamId={teamId} clubSlug={clubSlug} teamSlug={teamSlug} sessions={sessions} canManage={canManage} />
      )}

      {topTab === 'tournaments' && (
        <TeamTournaments clubSlug={clubSlug} teamSlug={teamSlug} entries={entries} />
      )}
    </div>
  );
}
