
import { act, newRoom, tick, view } from './game.mjs';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const hashToken = async (token) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))).map(v => v.toString(16).padStart(2, '0')).join('');
const nameOf = (v) => typeof v === 'string' ? v.trim().replace(/[\u0000-\u001f]/g, '').slice(0, 20) : '';
export async function handleGame(request, db, now = Date.now()) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return json({ error: 'Invalid request origin.' }, 403);
    const raw = await request.text();
    if (raw.length > 4096) return json({ error: 'Request too large.' }, 413);
    const data = JSON.parse(raw);
    if (!db) throw new Error('Room storage is unavailable.');
    if (data.action === 'create') {
      const name = nameOf(data.name);
      if (!name) throw new Error('Enter your player name.');
      if (![1,2,3].includes(data.lives)) throw new Error('Choose 1, 2, or 3 lives.');
      const token = crypto.randomUUID() + crypto.randomUUID();
      const player = { id: crypto.randomUUID(), name, token: await hashToken(token) };
      for (let i = 0; i < 5; i++) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => chars[b % chars.length]).join('');
        const room = newRoom(code, player, data.lives, now);
        const result = await db.prepare('INSERT OR IGNORE INTO rooms (code,state,version,expires) VALUES (?,?,0,?)').bind(code, JSON.stringify(room), room.expires).run();
        if (result.meta.changes) { await db.prepare('DELETE FROM rooms WHERE expires < ?').bind(now).run(); return json({ token, room: view(room, player.id, now) }); }
      }
      throw new Error('Please try creating the room again.');
    }
    const code = String(data.code ?? '').trim().toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(code)) throw new Error('Enter the six-character room code.');
    const joinToken = data.action === 'join' ? crypto.randomUUID() + crypto.randomUUID() : null;
    const hash = await hashToken(joinToken ?? String(data.token ?? ''));
    for (let attempt = 0; attempt < 12; attempt++) {
      const row = await db.prepare('SELECT state,version FROM rooms WHERE code = ? AND expires > ?').bind(code, now).first();
      if (!row) return json({ error: 'Room not found or expired. Ask the host for a new code.' }, 404);
      const room = JSON.parse(row.state);
      let player;
      if (data.action === 'join') {
        tick(room, now);
        if (room.phase !== 'lobby') throw new Error('This match has already started. Join the next room.');
        room.players = room.players.filter((p) => !p.departed && now - p.seen < 45000);
        if (room.players.length >= 6) throw new Error('This room is full (six players maximum).');
        const name = nameOf(data.name);
        if (!name) throw new Error('Enter your player name.');
        if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw new Error('That name is already in use in this room.');
        player = { id: crypto.randomUUID(), name, token: hash, lives: room.lives, ready: false, departed: false, seen: now };
        room.players.push(player); tick(room, now);
      } else {
        player = room.players.find((p) => p.token === hash && !p.departed);
        if (!player) return json({ error: 'Your session has ended. Join the room again.' }, 401);
        act(room, player.id, data.action, data, now);
      }
      // Version comparison makes simultaneous room mutations atomic.
      const updated = await db.prepare('UPDATE rooms SET state = ?, version = version + 1 WHERE code = ? AND version = ?').bind(JSON.stringify(room), code, row.version).run();
      if (updated.meta.changes) return json({ ...(joinToken ? { token: joinToken } : {}), room: view(room, player.id, now) });
    }
    return json({ error: 'The room is busy. Please try again.' }, 409);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update room.';
    if (/SQLITE|D1_|no such table|syntax error/i.test(message)) { console.error(message); return json({ error: 'Room storage is temporarily unavailable. Please retry.' }, 503); }
    return json({ error: message }, 400);
  }
}

