export const PHASE_MS = 30000;
export const active = r => r.players.filter(p => p.lives > 0 && !p.departed);
export function rules(round) { return { count: round < 7 ? 2 : 3, operators: round < 4 ? ['-'] : round < 7 ? ['+'] : ['-', '+'], range: Math.min(999, 20 + Math.floor((round - 1) / 3) * 10) }; }
const integer = (v, limit) => typeof v === 'number' && Number.isSafeInteger(v) && Math.abs(v) <= limit;
export const evaluate = (values, ops) => values.slice(1).reduce((n, v, i) => ops[i] === '+' ? n + v : n - v, values[0]);
export function validExpression(round, target, values) { const rule = rules(round); return Array.isArray(values) && values.length === rule.count && values.every(v => integer(v, rule.range)) && evaluate(values, rule.operators) === target; }
function shuffle(items) { const a = [...items]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function newRoom(code, player, lives, now) { return { code, host: player.id, lives, round: 0, phase: 'lobby', phaseId: 0, deadline: null, players: [{ ...player, lives, ready: false, seen: now, departed: false }], winner: null, suddenDeath: false, expires: now + 86400000 }; }
export function beginPhase(r, phase, now) {
  r.phase = phase; r.phaseId++; r.deadline = now + PHASE_MS;
  const players = active(r);
  if (phase === 'create') {
    r.round++;
    for (const p of players) { p.target = -(1 + Math.floor(Math.random() * rules(r.round).range)); p.submission = null; p.expression = null; p.problem = null; p.feedback = null; }
  } else {
    const ordered = shuffle(players);
    for (let i = 0; i < ordered.length; i++) {
      const p = ordered[i], other = [...ordered.slice(i + 1), ...ordered.slice(0, i)].find(q => q.expression);
      if (other) p.problem = { values: [...other.expression], operators: rules(r.round).operators, author: other.name };
      else { const n = 1 + Math.floor(Math.random() * rules(r.round).range); p.problem = { values: r.round < 4 ? [0, n] : r.round < 7 ? [-n, 0] : [0, n, 0], operators: rules(r.round).operators, author: 'Minus' }; }
      p.submission = null; p.feedback = null;
    }
  }
}
function finishPhase(r, now) {
  const participants = active(r), completed = r.phase;
  for (const p of participants) { const s = p.submission, correct = s?.correct === true; if (!correct) p.lives--; p.feedback = { correct, reason: !s ? 'Time ran out' : correct ? 'Correct!' : 'Incorrect answer', answer: completed === 'create' ? p.target : evaluate(p.problem.values, p.problem.operators), values: s?.values ?? null }; }
  const survivors = active(r);
  if (survivors.length === 1) { r.phase = 'finished'; r.winner = survivors[0].id; r.deadline = null; return; }
  if (!survivors.length) { for (const p of participants) p.lives = 1; r.suddenDeath = true; r.next = 'create'; }
  else r.next = completed === 'create' ? 'solve' : 'create';
  r.phase = 'results'; r.completed = completed; r.deadline = now + 5000;
}
export function tick(r, now) {
  const connected = r.players.filter(p => !p.departed && now - p.seen < 45000);
  if (connected.length && !connected.some(p => p.id === r.host)) r.host = connected[0].id;
  if (r.phase === 'results' && now >= r.deadline) beginPhase(r, r.next, now);
  else if (['create','solve'].includes(r.phase) && (now >= r.deadline || active(r).every(p => p.submission))) finishPhase(r, now);
}
export function act(r, id, action, data, now) {
  const p = r.players.find(p => p.id === id && !p.departed);
  if (!p) throw new Error('Your player session is no longer in this room.');
  p.seen = now; tick(r, now);
  if (action === 'poll') return;
  if (action === 'ready') { if (r.phase !== 'lobby') throw new Error('The game has already started.'); p.ready = !p.ready; }
  else if (action === 'start' || action === 'rematch') {
    if (r.host !== id) throw new Error('Only the host can start the game.');
    if (!['lobby','finished'].includes(r.phase)) throw new Error('A game is already running.');
    const connected = r.players.filter(q => !q.departed && now - q.seen < 45000);
    if (connected.length < 2) throw new Error('At least two connected players are needed.');
    r.players = connected;
    for (const q of r.players) { q.lives = r.lives; q.feedback = null; q.ready = false; }
    r.round = 0; r.winner = null; r.suddenDeath = false; beginPhase(r, 'create', now);
  } else if (action === 'submit') {
    if (!['create','solve'].includes(r.phase) || data.phaseId !== r.phaseId) throw new Error('That phase has ended.');
    if (p.lives <= 0) throw new Error('You are spectating.');
    if (p.submission) throw new Error('Your answer is already locked in.');
    if (r.phase === 'create') {
      const rule = rules(r.round);
      if (!Array.isArray(data.values) || data.values.length !== rule.count || !data.values.every(v => integer(v, rule.range))) throw new Error(`Enter ${rule.count} whole numbers between -${rule.range} and ${rule.range}.`);
      const correct = validExpression(r.round, p.target, data.values); p.submission = { correct, values: data.values }; if (correct) p.expression = data.values;
    } else { if (!integer(data.answer, 100000)) throw new Error('Enter a whole-number answer.'); p.submission = { correct: data.answer === evaluate(p.problem.values, p.problem.operators), values: [data.answer] }; }
    tick(r, now);
  } else if (action === 'leave') {
    p.departed = true; p.lives = 0;
    if (['create','solve','results'].includes(r.phase)) { const remaining = active(r); if (remaining.length <= 1) { r.phase = 'finished'; r.winner = remaining[0]?.id ?? null; r.deadline = null; } }
    tick(r, now);
  } else throw new Error('Unknown action.');
}
export function view(r, id, now) {
  const me = r.players.find(p => p.id === id);
  return { code: r.code, host: r.host, lives: r.lives, round: r.round, phase: r.phase, phaseId: r.phaseId, deadline: r.deadline, serverTime: now, winner: r.winner, suddenDeath: r.suddenDeath, completed: r.completed, rules: rules(r.round || 1),
    players: r.players.filter(p => !p.departed).map(p => ({ id: p.id, name: p.name, lives: p.lives, ready: p.ready, online: now - p.seen < 15000, submitted: !!p.submission })),
    me: { id, target: r.phase === 'create' ? me.target : undefined, problem: r.phase === 'solve' && me.lives > 0 ? me.problem : undefined, submitted: !!me.submission, feedback: ['results','finished'].includes(r.phase) ? me.feedback : undefined, lives: me.lives } };
}
