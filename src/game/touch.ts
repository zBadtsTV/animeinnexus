// Sem Phaser: pode ser importado pela interface React no servidor.
export type Action = 'left' | 'right' | 'jump' | 'run' | 'charge' | 'shoot' | 'punch' | 'ssj' | 'kaioken' | 'restore';

/** Botões da tela de toque (celular). Escritos pela interface React, lidos pelo jogo. */
export const touchState: Record<Action, boolean> = {
  left: false, right: false, jump: false, run: false, charge: false,
  shoot: false, punch: false, ssj: false, kaioken: false, restore: false,
};

const pendingPresses = new Set<Action>();

export function pressTouchAction(action: Action): void {
  touchState[action] = true;
  pendingPresses.add(action);
}

/** Preserve even a tap released between two game frames. */
export function consumeTouchPress(action: Action): boolean {
  return pendingPresses.delete(action);
}

export function resetTouchState(): void {
  pendingPresses.clear();
  for (const action of Object.keys(touchState) as Action[]) touchState[action] = false;
}

