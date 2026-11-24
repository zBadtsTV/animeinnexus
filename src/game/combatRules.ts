export const MATCH_DEATH_LIMIT = 3;
export const TRANSFORM_KEYS = { naruto: { K: 'sage', G: 'kyubi' }, luffy: { K: 'haki', G: 'gear' } } as const;
export const LUFFY_ATTACKS = {
  punch: { reach: 95, damage: 6, hits: 1, knockback: 260 },
  elastic: { reach: 245, damage: 14, hits: 1, knockback: 300 },
  bazooka: { reach: 125, damage: 18, hits: 1, knockback: 450 },
  gatling: { reach: 145, damage: 4, hits: 6, knockback: 100 },
} as const;
export function remainingLives(deaths: number): number { return Math.max(0, MATCH_DEATH_LIMIT - deaths); }
export function rasenganContact(attacker: { x: number; y: number; facing: number }, target: { x: number; y: number; width: number; height: number }): boolean {
  const left = attacker.facing > 0 ? attacker.x - 12 : attacker.x - 110;
  return left < target.x + target.width && left + 122 > target.x && attacker.y - 95 < target.y + target.height && attacker.y - 15 > target.y;
}
export function deathBaseForm(): 'normal' { return 'normal'; }
