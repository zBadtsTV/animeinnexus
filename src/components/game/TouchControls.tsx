import { touchState, type Action } from "@/game/touch";
import { SCREEN_IMAGES } from "@/game/fighterAssets";

function Btn({ img, action, label, className }: { img: string; action: Action; label: string; className: string }) {
  const set = (v: boolean) => (e: React.PointerEvent) => {
    e.preventDefault();
    touchState[action] = v;
  };
  return (
    <button
      type="button"
      aria-label={label}
      className={`pointer-events-auto touch-none select-none active:scale-90 transition-transform ${className}`}
      onPointerDown={set(true)}
      onPointerUp={set(false)}
      onPointerLeave={set(false)}
      onPointerCancel={set(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <img src={img} alt="" draggable={false} className="h-full w-full object-contain" />
    </button>
  );
}

/** Botões de toque para celular, sobre o jogo. */
export function TouchControls() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 [@media(pointer:fine)]:hidden">
      <div className="absolute bottom-4 left-4 flex items-end gap-2">
        <Btn img={SCREEN_IMAGES.btn_left} action="left" label="Esquerda" className="size-16" />
        <Btn img={SCREEN_IMAGES.btn_up} action="jump" label="Pular" className="mb-10 size-16" />
        <Btn img={SCREEN_IMAGES.btn_right} action="right" label="Direita" className="size-16" />
      </div>
      <div className="absolute bottom-4 right-4 flex items-end gap-3">
        <Btn img={SCREEN_IMAGES.btn_special} action="charge" label="Carregar" className="mb-14 size-14 opacity-80" />
        <Btn img={SCREEN_IMAGES.btn_special} action="shoot" label="Especial" className="size-16" />
        <Btn img={SCREEN_IMAGES.btn_punch} action="punch" label="Soco" className="size-20" />
      </div>
    </div>
  );
}
