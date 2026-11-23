import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const transport = vi.hoisted(() => {
  type Listener = (event: { payload: unknown }) => void;
  type Channel = { listener?: Listener; removed: boolean; on: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> };
  const channels: Channel[] = [];
  let dropAck = false;
  const channel = vi.fn(() => {
    const c: Channel = {
      removed: false,
      on: vi.fn((_type, _filter, cb: Listener) => { c.listener = cb; return c; }),
      subscribe: vi.fn((cb: (status: string) => void) => { cb('SUBSCRIBED'); return c; }),
      send: vi.fn((event: { payload: { msg: { t: string } } }) => {
        if (dropAck && event.payload.msg.t === 'ack') { dropAck = false; return Promise.resolve('ok'); }
        for (const other of channels) if (other !== c && !other.removed) other.listener?.({ payload: event.payload });
        return Promise.resolve('ok');
      }),
    };
    channels.push(c);
    return c;
  });
  return { channels, channel, dropNextAck: () => { dropAck = true; }, reset: () => { channels.length = 0; dropAck = false; } };
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  channel: transport.channel,
  removeChannel: vi.fn((channel: { removed: boolean }) => { channel.removed = true; return Promise.resolve('ok'); }),
} }));

import { hostRoom, joinRoom } from '../game/net';

describe('Multiplayer room lifetime', () => {
  beforeEach(() => { vi.useFakeTimers(); transport.reset(); });
  afterEach(() => { vi.useRealTimers(); });

  it('keeps a successful join connected beyond the 15-second room-search timeout', async () => {
    const host = await hostRoom('ABCDE', 'goku');
    const join = joinRoom('ABCDE', 'naruto');
    await vi.advanceTimersByTimeAsync(1000);
    const [a, b] = await Promise.all([host.link, join.link]);
    const closed = vi.fn();
    a.onClose(closed);
    const received = vi.fn();
    a.onMessage(received);
    await vi.advanceTimersByTimeAsync(30000);
    b.send({ t: 'hit', dmg: 10, dir: 1 });
    expect(received).toHaveBeenCalledWith({ t: 'hit', dmg: 10, dir: 1 });
    expect(closed).not.toHaveBeenCalled();
    expect(transport.channels.every((c) => !c.removed)).toBe(true);
    b.close();
    b.close();
    expect(closed).toHaveBeenCalledTimes(1);
    a.close();
  });

  it('retries a lost acknowledgment until both players connect', async () => {
    const host = await hostRoom('ABCDE', 'goku');
    transport.dropNextAck();
    const join = joinRoom('ABCDE', 'naruto');
    await vi.advanceTimersByTimeAsync(2000);
    const [a, b] = await Promise.all([host.link, join.link]);
    expect(a.remoteCharacter).toBe('naruto');
    expect(b.remoteCharacter).toBe('goku');
    a.close(); b.close();
  });

  it('rejects and disposes an unsuccessful join after 15 seconds', async () => {
    const join = joinRoom('ABCDE', 'naruto');
    const rejection = expect(join.link).rejects.toThrow('Sala não encontrada');
    await vi.advanceTimersByTimeAsync(15000);
    await rejection;
    expect(transport.channels[0]?.removed).toBe(true);
  });

  it('ignores departures from a third sender and removes close listeners', async () => {
    const host = await hostRoom('ABCDE', 'goku');
    const join = joinRoom('ABCDE', 'naruto');
    await vi.advanceTimersByTimeAsync(1000);
    const [a, b] = await Promise.all([host.link, join.link]);
    const closed = vi.fn();
    const unsubscribe = a.onClose(closed);
    transport.channels[0]?.listener?.({ payload: { from: 'stranger', msg: { t: 'bye' } } });
    expect(closed).not.toHaveBeenCalled();
    unsubscribe(); b.close();
    expect(closed).not.toHaveBeenCalled(); a.close();
  });
});