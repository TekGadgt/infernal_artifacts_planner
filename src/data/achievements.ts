// Achievements from wiki.august.games/wiki/Infernal_Artifacts_League/Achievements, via `npm run sync`.

import data from './generated/achievements.json';

export type PointSource = 'collectionLog' | 'achievements' | 'powers' | 'prestiges';

export interface Achievement {
  id: string;
  name: string;
  /** 0 = Starter through 6 = Heroic. */
  tier: number;
  description: string;
  points: number;
  rewards: string[];
  categories: string[];
  league: boolean;
  /** Power-banking achievements count toward Demonic Powers in the League points panel, the rest toward Achievements. */
  source: Extract<PointSource, 'achievements' | 'powers'>;
}

const POWER_BANKING = /^Bank .+|.+ at 60%$/;

export const achievements: Achievement[] = (data.achievements as Omit<Achievement, 'source'>[]).map((a) => ({
  ...a,
  source: a.league && POWER_BANKING.test(a.name) ? 'powers' : 'achievements',
}));
export const achievementById = new Map(achievements.map((a) => [a.id, a]));

export const ACHIEVEMENT_TIERS = ['Starter', 'Apprentice', 'Adept', 'Expert', 'Master', 'Grandmaster', 'Heroic'];

export const ACHIEVEMENT_CATEGORIES = [...new Set(achievements.flatMap((a) => a.categories))].sort();

export const ACHIEVEMENTS_URL = 'https://wiki.august.games/wiki/Infernal_Artifacts_League/Achievements';

// The four sources in the in-game League points panel, with the maximums it shows.
export const POINT_SOURCES: { id: PointSource; label: string; max: number }[] = [
  { id: 'collectionLog', label: 'Collection log slots', max: 166025 },
  { id: 'achievements', label: 'Achievements', max: 147640 },
  { id: 'powers', label: 'Demonic Powers', max: 46300 },
  { id: 'prestiges', label: 'Prestiges', max: 45000 },
];

/** League points per skill prestige. */
export const PRESTIGE_POINTS = 225;
export const MAX_PRESTIGES = 45000 / PRESTIGE_POINTS;

/** What the wiki list adds up to per source, to compare against the in-game maximums. */
export const LISTED_POINTS = {
  achievements: achievements.filter((a) => a.source === 'achievements').reduce((n, a) => n + a.points, 0),
  powers: achievements.filter((a) => a.source === 'powers').reduce((n, a) => n + a.points, 0),
};
