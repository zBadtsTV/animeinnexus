import { supabase } from '@/integrations/supabase/client';

export type CharacterId = 'goku' | 'naruto' | 'luffy';

/** Mensagens trocadas entre os dois jogadores. */
export type NetMsg =
  | { t: 'hello'; ch: CharacterId }
  | { t: 's'; x: number; y: number; tex: string; fr: number | string; flip: boolean; ox: number; oy: number; scale: number; hp: number; en: number; form: string }
  | { t: 'hit'; dmg: number; dir: number; knockback?: number }
  | { t: 'ball'; x: number; y: number; dir: number; size: number; form: string }
  | { t: 'death'; deaths: number }
  | { t: 'rematch' }
  | { t: 'pick'; ch: CharacterId };

export interface NetLink {
  isHost: boolean;
  remoteCharacter: CharacterId;
  send(msg: NetMsg): void;
  onMessage(cb: (msg: NetMsg) => void): () => void;
  onClose(cb: () => void): () => void;
  close(): void;
}

type Wire = { from: string; msg: NetMsg | { t: 'hello'; ch: CharacterId; host: boolean } | { t: 'ack'; to: string; ch: CharacterId; host: boolean } | { t: 'bye' } };

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
  const closers = new Set<() => void>();
  let closed = false;
  let resolved = false;
  let peer: string | undefined;
  let latestState: Extract<NetMsg, { t: 's' }> | undefined;
  let rejectPending: ((error: Error) => void) | undefined;
  let helloTimer: ReturnType<typeof setInterval> | undefined;
  let joinTimer: ReturnType<typeof setTimeout> | undefined;
  const raw = (msg: Wire['msg']) => void channel.send({ type: 'broadcast', event: 'm', payload: { from: me, msg } satisfies Wire });
  const clearTimers = () => {
    clearInterval(helloTimer);
    clearTimeout(joinTimer);
    helloTimer = undefined;
    joinTimer = undefined;
  };
  const dispose = () => {
    closed = true;
    clearTimers();
    listeners.clear();
    closers.clear();
    void supabase.removeChannel(channel);
  };
  const cancel = () => {
    if (closed) return;
    if (resolved) raw({ t: 'bye' });
    else rejectPending?.(new Error('Conexão cancelada'));
    dispose();
  };
  const link = new Promise<NetLink>((resolve, reject) => {
    rejectPending = reject;
    const finish = (remoteCharacter: CharacterId) => {
      if (resolved || closed) return;
      resolved = true;
      clearTimers(); // A successful join must never retain its room-search timeout.
      resolve({
        isHost,
        remoteCharacter,
        send: (m) => { if (!closed) raw(m); },
        onMessage: (cb) => {
          listeners.add(cb);
          if (latestState) cb(latestState);
          return () => { listeners.delete(cb); };
        },
        onClose: (cb) => {
          closers.add(cb);
          return () => { closers.delete(cb); };
        },
        close: cancel,
      });
    };
    channel.on('broadcast', { event: 'm' }, ({ payload }) => {
      const w = payload as Wire;
      if (closed || w.from === me || (peer && w.from !== peer)) return;
      if (w.msg.t === 'hello') {
        if (!('host' in w.msg) || w.msg.host === isHost) return;
        peer = w.from;
        // Keep acknowledging retries after local resolution; never echo hello endlessly.
        raw({ t: 'ack', to: w.from, ch, host: isHost });
        return;
      }
      if (w.msg.t === 'ack') {
        if (w.msg.to !== me || w.msg.host === isHost) return;
        peer = w.from;
        finish(w.msg.ch);
        return;
      }
      if (!resolved || w.from !== peer) return;
      if (w.msg.t === 'bye') {
        const callbacks = [...closers];
        dispose();
        callbacks.forEach((cb) => cb());
        return;
      }
      const msg = w.msg;
      if (msg.t === 's') latestState = msg;
      listeners.forEach((l) => l(msg));
    });
    channel.subscribe((status) => {
      if (closed) return;
      if (status === 'SUBSCRIBED' && !resolved) {
        clearInterval(helloTimer);
        raw({ t: 'hello', ch, host: isHost });
        helloTimer = setInterval(() => raw({ t: 'hello', ch, host: isHost }), 500);
      } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !resolved) {
        reject(new Error('Falha de conexão'));
        dispose();
      }
    });
    if (!isHost && !resolved && !closed) {
      joinTimer = setTimeout(() => {
        reject(new Error('Sala não encontrada'));
        dispose();
      }, 15000);
    }
  });
  return { link, cancel };
}

/** Cria a sala e espera o outro jogador entrar. */
export async function hostRoom(code: string, ch: CharacterId): Promise<{ link: Promise<NetLink>; cancel: () => void }> {
  return connect(code, true, ch);
}

export function joinRoom(code: string, ch: CharacterId): { link: Promise<NetLink>; cancel: () => void } {
  return connect(code, false, ch);
}
