import type { ScoreEntry } from './types';

export class LocalLeaderboard {
  private readonly key: string;
  constructor(gameId: string, private limit = 10) { this.key = `${gameId}:leaderboard`; }

  load(): ScoreEntry[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.key) ?? '[]') as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isScoreEntry).sort(compareEntries).slice(0, this.limit);
    } catch { return []; }
  }

  submit(entry: Omit<ScoreEntry, 'id'|'recordedAt'>): ScoreEntry[] {
    const completed: ScoreEntry = { ...entry, id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`, recordedAt:new Date().toISOString() };
    const scores = [...this.load(), completed].sort(compareEntries).slice(0, this.limit);
    localStorage.setItem(this.key, JSON.stringify(scores));
    return scores;
  }

  clear(): void { localStorage.removeItem(this.key); }
}

function compareEntries(a: ScoreEntry, b: ScoreEntry): number {
  return b.score - a.score || b.graze - a.graze || b.recordedAt.localeCompare(a.recordedAt);
}

function isScoreEntry(value: unknown): value is ScoreEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<ScoreEntry>;
  return typeof entry.id === 'string' && typeof entry.score === 'number' && Number.isFinite(entry.score) && entry.score >= 0 && typeof entry.graze === 'number' && typeof entry.cleared === 'boolean' && typeof entry.playerId === 'string' && typeof entry.playerName === 'string' && typeof entry.recordedAt === 'string';
}
