/** Body-size corrections for mixed generated sheets and uploaded strips, excluding aura extents. */
const TEXTURE_SCALE: Record<string, number> = {
  ssj: 0.86,
  kaioken: 0.84,
  ssj_walk: 0.82,
  ssj_run: 0.9,
  ssj_charge_loop: 1,
  kaioken_charge_loop: 0.88,
  kaioken_charge_start: 0.88,
  naruto_kyubi_transform: 0.9,
};

export function spriteSizeCorrection(texture: string): number {
  return TEXTURE_SCALE[texture] ?? (texture.startsWith('naruto_kyubi') ? 0.82 : 1);
}

/** Left/right stay bounded; the top is open in both modes. Multiplayer may fall below the arena. */
export function worldBoundsCollision(mode: 'single' | 'multi'): [boolean, boolean, boolean, boolean] {
  return [true, true, false, mode === 'single'];
}