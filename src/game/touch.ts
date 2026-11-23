// Sem Phaser: pode ser importado pela interface React no servidor.
export type Action = 'left' | 'right' | 'jump' | 'run' | 'charge' | 'shoot' | 'punch' | 'ssj' | 'kaioken' | 'restore';

/** Botões da tela de toque (celular). Escritos pela interface React, lidos pelo jogo. */
export const touchState: Record<Action, boolean> = {
  left: false, right: false, jump: false, run: false, charge: false,
  shoot: false, punch: false, ssj: false, kaioken: false, restore: false,
};

export function resetTouchState(): void {
  for (const action of Object.keys(touchState) as Action[]) touchState[action] = false;
}

