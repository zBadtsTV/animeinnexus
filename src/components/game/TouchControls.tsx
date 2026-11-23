import { useEffect } from "react";
import { pressTouchAction, resetTouchState, touchState, type Action } from "@/game/touch";
import { SCREEN_IMAGES } from "@/game/fighterAssets";
import type { CharacterId } from "@/game/net";

function Btn({ img, action, label, className }: { img: string; action: Action; label: string; className: string }) {
  const set = (v: boolean) => (e: React.PointerEvent) => {
    e.preventDefault();
    if (v) e.currentTarget.setPointerCapture(e.pointerId);
    if (v) pressTouchAction(action);
    else touchState[action] = false;
  };
  return (
    <button
      type="button"
      aria-label={label}
      className={`pointer-events-auto touch-none select-none active:scale-90 transition-transform ${className}`}
      onPointerDown={set(true)}
      onPointerUp={set(false)}
      onLostPointerCapture={set(false)}
      onPointerCancel={set(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <img src={img} alt="" draggable={false} className="h-full w-full object-contain" />
    </button>
  );
}

/** Botões de toque para celular, sobre o jogo. */
export function TouchControls({ character }: { character: CharacterId }) {
  useEffect(() => {
    const clear = () => resetTouchState();
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    return () => {
      clear();
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
    };
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0 z-10 hidden [@media(pointer:coarse)]:block">
      <div className="absolute bottom-4 left-2 grid grid-cols-3 items-end gap-1 sm:left-4 sm:gap-2">
        <Btn img={SCREEN_IMAGES.btn_left} action="left" label="Esquerda" className="size-11 sm:size-14" />
        <Btn img={SCREEN_IMAGES.btn_up} action="jump" label="Pular" className="mb-8 size-11 sm:size-14" />
        <Btn img={SCREEN_IMAGES.btn_right} action="right" label="Direita" className="size-11 sm:size-14" />
      </div>
      <div className="absolute bottom-4 right-2 grid grid-cols-3 gap-1 sm:right-4 sm:gap-2">
        <Btn img={SCREEN_IMAGES.btn_special} action="ssj" label="Transformar" className="size-11 opacity-80 hue-rotate-180 sm:size-14" />
        <Btn img={SCREEN_IMAGES.btn_special} action="charge" label="Carregar" className="size-11 opacity-80 sm:size-14" />
        <Btn img={SCREEN_IMAGES.btn_right} action="run" label="Correr" className="size-11 sm:size-14" />
        {character === 'goku' ? <Btn img={SCREEN_IMAGES.btn_special} action="kaioken" label="Kaioken" className="size-11 hue-rotate-90 sm:size-14" /> : <span />}
        <Btn img={SCREEN_IMAGES.btn_special} action="shoot" label="Especial" className="size-11 sm:size-14" />
        <Btn img={SCREEN_IMAGES.btn_punch} action="punch" label="Soco" className="size-11 sm:size-14" />
      </div>
    </div>
  );
}
