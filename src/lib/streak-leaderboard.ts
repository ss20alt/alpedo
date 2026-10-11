export interface StreakLeaderboardCandidate {
  displayName: string;
  days: number;
}

export interface RankedStreakParticipant extends StreakLeaderboardCandidate {
  rank: number;
}

export function rankStreakParticipants(candidates: StreakLeaderboardCandidate[]): RankedStreakParticipant[] {
  const ordered = candidates
    .filter(({ displayName, days }) => displayName.trim().length > 0 && Number.isFinite(days) && days >= 0)
    .map(({ displayName, days }) => ({ displayName: displayName.trim().slice(0, 40), days: Math.floor(days) }))
    .sort((a, b) => b.days - a.days || a.displayName.localeCompare(b.displayName, "es-PY"));

  let previousDays: number | null = null;
  let currentRank = 0;
  return ordered.map((participant, index) => {
    if (participant.days !== previousDays) currentRank = index + 1;
    previousDays = participant.days;
    return { ...participant, rank: currentRank };
  });
}
