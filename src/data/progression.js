// Player Level from total XP (03_ECONOMY §2): XPToNext(L) = 100 + 30 × (L − 1). Level only gates items in the MVP.

export const PROGRESSION = {
  baseXpToNext: 100,
  xpGrowthPerLevel: 30,
  maxPlayerLevel: 30,   // safety cap (the table documents levels 1–10; the formula continues)
};

export const xpToNext = (level) => PROGRESSION.baseXpToNext + PROGRESSION.xpGrowthPerLevel * (level - 1);

/** Total XP needed to reach `level` (level 1 → 0). */
export function xpForLevel(level) {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToNext(l);
  return total;
}

/** Player Level for a total XP amount. */
export function levelForXp(totalXp) {
  const xp = Number.isFinite(totalXp) && totalXp > 0 ? totalXp : 0;
  let level = 1, need = xpToNext(1), acc = 0;
  while (level < PROGRESSION.maxPlayerLevel && xp >= acc + need) {
    acc += need;
    level += 1;
    need = xpToNext(level);
  }
  return level;
}

/** Progress inside the current level: { level, into, need } (presentation: XP bar). */
export function levelProgress(totalXp) {
  const level = levelForXp(totalXp);
  const start = xpForLevel(level);
  return { level, into: Math.max(0, totalXp - start), need: xpToNext(level) };
}
