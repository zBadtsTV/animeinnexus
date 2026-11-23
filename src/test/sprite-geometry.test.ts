import { describe, expect, it } from 'vitest';
import { spriteSizeCorrection, worldBoundsCollision } from '../game/spriteGeometry';
import { SPRITE_OVERRIDES } from '../game/spriteOverrides';
import { resetTouchState, touchState } from '../game/touch';

describe('Fighter geometry', () => {
  it('leaves the ceiling open in single and multiplayer without removing side boundaries', () => {
    expect(worldBoundsCollision('single')).toEqual([true, true, false, true]);
    expect(worldBoundsCollision('multi')).toEqual([true, true, false, false]);
  });
  it('reduces oversized Sayajin body and charge sheets while preserving normal Goku', () => {
    expect(spriteSizeCorrection('normal')).toBe(1);
    expect(spriteSizeCorrection('ssj')).toBe(0.86);
    expect(spriteSizeCorrection('ssj_charge_loop')).toBe(0.82);
  });
  it('reverses the aligned transformation strips instead of using oversized aura sheets', () => {
    expect(SPRITE_OVERRIDES.find((s) => s.keys.includes('ssj:revert'))?.frames).toEqual([7, 6, 5, 4, 3, 2, 1, 0]);
    expect(SPRITE_OVERRIDES.find((s) => s.keys.includes('kaioken:revert'))?.frames).toEqual([6, 5, 4, 3, 2, 1, 0]);
  });
  it('releases every held mobile action on cleanup', () => {
    touchState.left = true; touchState.shoot = true; touchState.run = true;
    resetTouchState();
    expect(Object.values(touchState).every((down) => !down)).toBe(true);
  });
});