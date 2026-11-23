import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SCREEN_IMAGES } from "@/game/fighterAssets";
import type { CharacterId, NetLink } from "@/game/net";
import { TouchControls } from "@/components/game/TouchControls";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aetheria — Goku vs Naruto" },
      { name: "description", content: "Luta de plataforma com Goku e Naruto: treino solo com bonecos ou duelo online com um amigo." },
      { property: "og:title", content: "Aetheria — Goku vs Naruto" },
      { property: "og:description", content: "Treino solo ou duelo online entre Goku e Naruto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Mode = "single" | "multi";
type Screen =
  | { s: "menu" }
  | { s: "select"; mode: Mode }
  | { s: "lobby"; ch: CharacterId }
  | { s: "game"; mode: Mode; ch: CharacterId; net?: NetLink };

function Index() {
  const [screen, setScreen] = useState<Screen>({ s: "menu" });
  return (
    <main className="relative flex h-dvh w-screen items-center justify-center overflow-hidden bg-foreground">
      {screen.s === "menu" && <Menu onPick={(mode) => setScreen({ s: "select", mode })} />}
      {screen.s === "select" && (
        <Select
          onBack={() => setScreen({ s: "menu" })}
          onPick={(ch) => setScreen(screen.mode === "multi" ? { s: "lobby", ch } : { s: "game", mode: "single", ch })}
        />
      )}
      {screen.s === "lobby" && (
        <Lobby ch={screen.ch} onBack={() => setScreen({ s: "menu" })} onReady={(net) => setScreen({ s: "game", mode: "multi", ch: screen.ch, net })} />
      )}
      {screen.s === "game" && (
        <Game mode={screen.mode} ch={screen.ch} net={screen.net} onExit={() => { screen.net?.close(); setScreen({ s: "menu" }); }} />
      )}
    </main>
  );
}

/** Caixa 16:9 que cabe na tela; filhos posicionados em %. */
function Stage({ children }: { children: React.ReactNode }) {
  return <div className="relative aspect-video w-[min(100vw,177.78dvh)]">{children}</div>;
}

function Menu({ onPick }: { onPick: (m: Mode) => void }) {
  return (
    <Stage>
      <img src={SCREEN_IMAGES.arena} alt="" className="absolute inset-0 h-full w-full object-cover brightness-50" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[3%]">
        <h1 className="font-game text-[6vmin] text-game-gold drop-shadow-[0_4px_0_oklch(0.3_0.1_30)]">AETHERIA</h1>
        <button className="game-btn" onClick={() => onPick("single")}>SINGLE PLAYER</button>
        <button className="game-btn" onClick={() => onPick("multi")}>MULTIPLAYER</button>
      </div>
    </Stage>
  );
}

function Select({ onPick, onBack }: { onPick: (c: CharacterId) => void; onBack: () => void }) {
  const [ch, setCh] = useState<CharacterId | null>(null);
  const img = ch === "goku" ? SCREEN_IMAGES.select_goku : ch === "naruto" ? SCREEN_IMAGES.select_naruto : SCREEN_IMAGES.select_base;
  const hot = "absolute cursor-pointer rounded-md";
  return (
    <Stage>
      <img src={img} alt="Seleção de personagem" className="absolute inset-0 h-full w-full select-none" draggable={false} />
      <button aria-label="Naruto" className={`${hot} left-[37%] top-[37%] h-[23%] w-[12%]`} onClick={() => setCh("naruto")} />
      <button aria-label="Goku" className={`${hot} left-[50.5%] top-[37%] h-[23%] w-[13%]`} onClick={() => setCh("goku")} />
      <button aria-label="Anterior" className={`${hot} left-[32%] top-[42%] h-[14%] w-[4%]`} onClick={() => setCh("naruto")} />
      <button aria-label="Próximo" className={`${hot} left-[64%] top-[42%] h-[14%] w-[4%]`} onClick={() => setCh("goku")} />
      <button aria-label="Naruto" className={`${hot} left-0 top-[10%] h-[80%] w-[30%]`} onClick={() => setCh("naruto")} />
      <button aria-label="Goku" className={`${hot} right-0 top-[10%] h-[80%] w-[30%]`} onClick={() => setCh("goku")} />
      <button
        aria-label="Select"
        disabled={!ch}
        className={`${hot} left-[36%] top-[76%] h-[14%] w-[28%] disabled:cursor-not-allowed`}
        onClick={() => ch && onPick(ch)}
      />
      {!ch && <p className="absolute bottom-[3%] w-full text-center font-game text-[2vmin] text-game-gold">Escolha Naruto ou Goku</p>}
      <button className="game-btn-sm absolute left-[2%] top-[3%]" onClick={onBack}>← Voltar</button>
    </Stage>
  );
}

function Lobby({ ch, onReady, onBack }: { ch: CharacterId; onReady: (n: NetLink) => void; onBack: () => void }) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<() => void>(() => {});
  const attemptRef = useRef(0);
  useEffect(() => () => { attemptRef.current++; cancelRef.current(); }, []);

  const connect = async (hosting: boolean) => {
    if (busy || (!hosting && !code.trim())) return;
    const attempt = ++attemptRef.current;
    cancelRef.current();
    setBusy(true);
    try {
      const net = await import("@/game/net");
      if (attempt !== attemptRef.current) return;
      const c = hosting ? net.makeRoomCode() : code;
      setStatus(hosting ? `Sala ${c} criada. Passe o código para seu amigo. Esperando...` : "Entrando...");
      const { link, cancel } = hosting ? await net.hostRoom(c, ch) : net.joinRoom(c, ch);
      cancelRef.current = cancel;
      const l = await link;
      if (attempt !== attemptRef.current) { l.close(); return; }
      cancelRef.current = () => {};
      onReady(l);
    } catch {
      if (attempt === attemptRef.current) setStatus(hosting ? "Não deu para criar a sala. Tente de novo." : "Sala não encontrada.");
    } finally {
      if (attempt === attemptRef.current) setBusy(false);
    }
  };
  return (
    <Stage>
      <img src={SCREEN_IMAGES.arena} alt="" className="absolute inset-0 h-full w-full object-cover brightness-50" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <h2 className="font-game text-[4vmin] text-game-gold">MULTIPLAYER</h2>
        <button className="game-btn" disabled={busy} onClick={() => void connect(true)}>CRIAR SALA</button>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CÓDIGO"
            maxLength={5}
            className="w-36 rounded-md border-2 border-game-gold bg-background px-3 py-2 text-center font-game text-xl text-foreground"
          />
          <button className="game-btn-sm" disabled={busy} onClick={() => void connect(false)}>ENTRAR</button>
        </div>
        <p className="min-h-6 font-game text-lg text-background">{status}</p>
        <button className="game-btn-sm" onClick={onBack}>← Menu</button>
      </div>
    </Stage>
  );
}

function Game({ mode, ch, net, onExit }: { mode: Mode; ch: CharacterId; net?: NetLink | undefined; onExit: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const gameRef = useRef<{ events: { emit: (e: string) => void } } | null>(null);
  useEffect(() => {
    let game: { destroy: (a: boolean, b: boolean) => void; events: { emit: (e: string) => void } } | undefined;
    let cancelled = false;
    import("../game/startGame").then(({ startGame }) => {
      if (cancelled || !ref.current) return;
      game = startGame(ref.current, net ? { mode, character: ch, net } : { mode, character: ch });
      gameRef.current = game;
    });
    return () => {
      cancelled = true;
      game?.destroy(true, false);
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="absolute inset-0">
      <div ref={ref} className="h-full w-full" />
      <div className="absolute right-3 top-3 z-20 flex gap-2">
        {mode === "single" && (
          <button className="game-btn-sm" onClick={() => gameRef.current?.events.emit("spawn-dummy")}>+ Dummy</button>
        )}
        <button className="game-btn-sm" onClick={onExit}>Menu</button>
      </div>
      <TouchControls character={ch} />
    </div>
  );
}
