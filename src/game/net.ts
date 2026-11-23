import { supabase } from '@/integrations/supabase/client';

export type CharacterId = 'goku' | 'naruto';

/** Mensagens trocadas entre os dois jogadores. */
export type NetMsg =
  | { t: 'hello'; ch: CharacterId }
  | { t: 's'; x: number; y: number; tex: string; fr: number | string; flip: boolean; ox: number; oy: number; hp: number; en: number; form: string }
  | { t: 'hit'; dmg: number; dir: number }
  | { t: 'ball'; x: number; y: number; dir: number; size: number; form: string };

export interface NetLink {
  isHost: boolean;
  remoteCharacter: CharacterId;
  send(msg: NetMsg): void;
  onMessage(cb: (msg: NetMsg) => void): () => void;
  onClose(cb: () => void): void;
  close(): void;
}

type Wire = { from: string; msg: NetMsg | { t: 'bye' } };

export function makeRoomCode(): string {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

/** Conecta pela nuvem (websocket) — funciona em qualquer rede, sem WebRTC. */
function connect(code: string, isHost: boolean, ch: CharacterId): { link: Promise<NetLink>; cancel: () => void } {
  const me = Math.random().toString(36).slice(2);
  const channel = supabase.channel('aetheria-room-' + code.trim().toUpperCase(), {
    config: { broadcast: { self: false, ack: false } },
  });
  const listeners = new Set<(m: NetMsg) => void>();
  const closers: (() => void)[] = [];
  let closed = false;
  let resolved = false;
  let helloTimer: ReturnType<typeof setInterval> | undefined;
  const raw = (msg: Wire['msg']) => void channel.send({ type: 'broadcast', event: 'm', payload: { from: me, msg } satisfies Wire });
  const cancel = () => {
    if (closed) return;
    closed = true;
    clearInterval(helloTimer);
    raw({ t: 'bye' });
    void supabase.removeChannel(channel);
  };
  const link = new Promise<NetLink>((resolve, reject) => {
    channel.on('broadcast', { event: 'm' }, ({ payload }) => {
      const w = payload as Wire;
      if (w.from === me) return;
      if (w.msg.t === 'bye') {
        if (resolved) closers.forEach((c) => c());
        return;
      }
      if (w.msg.t === 'hello') {
        if (!resolved) {
          resolved = true;
          clearInterval(helloTimer);
          raw({ t: 'hello', ch }); // garante que o outro lado também recebe
          resolve({
            isHost,
            remoteCharacter: w.msg.ch,
            send: (m) => !closed && raw(m),
            onMessage: (cb) => {
              listeners.add(cb);
              return () => listeners.delete(cb);
            },
            onClose: (cb) => closers.push(cb),
            close: cancel,
          });
        }
        return;
      }
      listeners.forEach((l) => l(w.msg as NetMsg));
    });
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        raw({ t: 'hello', ch });
        helloTimer = setInterval(() => raw({ t: 'hello', ch }), 1000);
      } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !resolved) {
        reject(new Error('Falha de conexão'));
      }
    });
  });
  return { link, cancel };
}

/** Cria a sala e espera o outro jogador entrar. */
export async function hostRoom(code: string, ch: CharacterId): Promise<{ link: Promise<NetLink>; cancel: () => void }> {
  return connect(code, true, ch);
}

export async function joinRoom(code: string, ch: CharacterId): Promise<NetLink> {
  const { link, cancel } = connect(code, false, ch);
  const timeout = new Promise<never>((_, rej) =>
    setTimeout(() => {
      cancel();
      rej(new Error('Sala não encontrada'));
    }, 15000),
  );
  return Promise.race([link, timeout]);
}
