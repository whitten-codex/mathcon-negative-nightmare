'use client';
import { Fragment, useEffect, useRef, useState } from 'react';

type Player = { id: string; name: string; lives: number; ready: boolean; online: boolean; submitted: boolean };
type Room = { code: string; host: string; lives: number; round: number; phase: string; phaseId: number; deadline: number | null; serverTime: number; winner: string | null; suddenDeath: boolean; rules: { count: number; operators: string[]; range: number }; players: Player[]; me: { id: string; lives: number; target?: number; submitted: boolean; problem?: { values: number[]; operators: string[]; author: string }; feedback?: { correct: boolean; reason: string; answer: number } } };
type Session = { code: string; token: string };
const display = (v: number) => String(v).replace('-', '−');
function Minus({ small = false }: { small?: boolean }) { return <div className={`minus ${small ? 'small' : ''}`} role="img" aria-label="Minus, your friendly math host"><div className="eyes"><i/><i/></div><div className="minus-sign">−</div></div>; }
export default function Home() {
  const [room, setRoom] = useState<Room | null>(null), [session, setSession] = useState<Session | null>(null);
  const [name, setName] = useState(''), [code, setCode] = useState(''), [lives, setLives] = useState(3);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [offline, setOffline] = useState(false);
  const [values, setValues] = useState(['','','']), [answer, setAnswer] = useState(''), [now, setNow] = useState(Date.now()), [offset, setOffset] = useState(0), [copied, setCopied] = useState(false);
  const inFlight = useRef(false), generation = useRef(0), roomRef = useRef<Room | null>(null);
  function accept(next: Room) {
    const prior = roomRef.current;
    if (prior && next.phaseId < prior.phaseId) return;
    roomRef.current = next; setRoom(next); setOffset(next.serverTime - Date.now()); setOffline(false);
  }
  useEffect(() => {
    try { const saved = sessionStorage.getItem('mathcon-session'); if (saved) setSession(JSON.parse(saved)); } catch {}
    const initial = new URLSearchParams(window.location.search).get('room'); if (initial) setCode(initial.toUpperCase().slice(0,6));
    const clock = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(clock);
  }, []);
  useEffect(() => { setValues(['','','']); setAnswer(''); setError(''); }, [room?.phaseId]);
  useEffect(() => {
    if (!session) return;
    let stopped = false, timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (inFlight.current) { timer = setTimeout(poll, 300); return; }
      inFlight.current = true;
      try {
        const res = await fetch('/api/game', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...session, action: 'poll' }), signal: AbortSignal.timeout(10000) });
        const data = await res.json() as { room: Room; token?: string; error?: string };
        if (!stopped) {
          if (data.room) accept(data.room);
          else if ([401,404].includes(res.status)) { setError(data.error || 'Your room session has ended.'); setSession(null); setRoom(null); roomRef.current = null; sessionStorage.removeItem('mathcon-session'); }
          else setOffline(true);
        }
      } catch { if (!stopped) setOffline(true); }
      finally { inFlight.current = false; if (!stopped) timer = setTimeout(poll, 900); }
    };
    poll(); return () => { stopped = true; clearTimeout(timer); };
  }, [session]);
  async function action(actionName: string, extra: Record<string, unknown> = {}) {
    if (busy) return;
    setBusy(true); setError('');
    const current = ++generation.current;
    // Let an existing poll finish before changing state to avoid stale responses.
    while (inFlight.current) await new Promise(resolve => setTimeout(resolve, 40));
    inFlight.current = true;
    try {
      const res = await fetch('/api/game', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...session, action: actionName, ...extra }), signal: AbortSignal.timeout(12000) });
      const data = await res.json() as { room: Room; token?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Unable to update the room.');
      if (current !== generation.current) return;
      if (data.token) { const next = { code: data.room.code, token: data.token }; sessionStorage.setItem('mathcon-session', JSON.stringify(next)); setSession(next); }
      if (actionName === 'leave') { sessionStorage.removeItem('mathcon-session'); setSession(null); setRoom(null); roomRef.current = null; }
      else accept(data.room);
    } catch (e) { setError(e instanceof Error ? e.message : 'Connection lost. Please retry.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const seconds = room?.deadline ? Math.max(0, Math.ceil((room.deadline - now - offset) / 1000)) : 0;
  const host = room?.host === room?.me.id, playing = room && ['create','solve'].includes(room.phase);
  const winner = room?.players.find(p => p.id === room.winner);
  async function copyRoom() { if (!room) return; try { await navigator.clipboard.writeText(`${window.location.origin}/?room=${room.code}`); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { setError(`Share room code ${room.code} with your friends.`); } }
  return <main>
    <header><a className="brand" href="/" onClick={e => { if (session) e.preventDefault(); }}><span className="brand-icon">−</span> MathCon<span className="brand-dot">●</span></a><span className="header-note">A little negative. A lot of fun.</span><span className="pill">2–6 PLAYERS</span></header>
    {!room ? <>
      <section className="welcome">
        <div className="intro"><div className="eyebrow"><span/> THE MULTIPLAYER MATH SHOWDOWN</div><h1>Negative<br/><span>Nightmare</span><b>!</b></h1><p className="lede">Think fast. Go negative.<br/>Be the last mathematician standing.</p><div className="host-intro"><Minus/><div className="speech">“I’m Minus. Got what it takes<br/>to survive the negatives?”<span>YOUR HOST, MINUS</span></div></div><div className="features"><span>✓ No accounts needed</span><span>✓ Play on any device</span></div></div>
        <section className="card entry"><div className="eyebrow">YOUR NEXT MATH ADVENTURE</div><h2>Enter the nightmare</h2><p>Create a room or join your friends.</p><label htmlFor="name">Player name</label><input id="name" autoComplete="nickname" placeholder="What should Minus call you?" value={name} maxLength={20} onChange={e => setName(e.target.value)}/><label htmlFor="code">Room code</label><div className="join-row"><input id="code" placeholder="ABC234" value={code} maxLength={6} autoCapitalize="characters" onChange={e => setCode(e.target.value.toUpperCase())}/><button disabled={busy || !name.trim() || code.length !== 6} onClick={() => action('join', { name, code })}>Join game ↗</button></div><div className="divider"><span>OR START YOUR OWN</span></div><label htmlFor="lives">Choose your challenge</label><select id="lives" value={lives} onChange={e => setLives(Number(e.target.value))}><option value={1}>♥ 1 life · Nightmare Mode</option><option value={2}>♥♥ 2 lives · Challenge Mode</option><option value={3}>♥♥♥ 3 lives · Practice Mode</option></select><button className="primary full" disabled={busy || !name.trim()} onClick={() => action('create', { name, lives })}>{busy ? 'Connecting…' : 'Create a room →'}</button><p className="fine">Share a code. Gather your crew. Let the math begin.</p>{session && <p role="status">Reconnecting to your room…</p>}</section>
      </section>
      <section className="how"><div><div className="eyebrow">THE RULES ARE SIMPLE</div><h2>Create. Solve. Survive.</h2></div><article><span className="step">01</span><h3>Make it negative</h3><p>Build an expression that equals your secret negative target.</p><code>5 − 10 = −5</code></article><article><span className="step">02</span><h3>Face your friends</h3><p>Solve another player’s expression. You have 30 seconds.</p><code>8 − 13 = ?</code></article><article><span className="step">03</span><h3>Stay in the game</h3><p>Wrong or late? Lose a life. The last player standing wins.</p><code className="pink">♥ ♥ ♥</code></article></section>
    </> : <>
      <div className="room-top"><div><span className="eyebrow">YOUR PRIVATE GAME ROOM</span><h1 className="room-code">{room.code}</h1></div><div className="room-actions"><button className="secondary" onClick={copyRoom}>{copied ? 'Link copied ✓' : 'Copy invite link'}</button><button className="text-button" disabled={busy} onClick={() => action('leave')}>Leave room</button></div></div>
      {offline && <div className="notice" role="status">Connection interrupted. Reconnecting… The game timer continues.</div>}
      {room.suddenDeath && room.phase !== 'finished' && <div className="sudden">⚡ SUDDEN DEATH · Tied players have one final life. Survive to win.</div>}
      <div className="arena"><section className="card play-card">
        <div className="play-head"><div className="eyebrow">{room.phase === 'lobby' ? 'GATHER YOUR CREW' : room.phase === 'finished' ? 'NIGHTMARE COMPLETE' : `ROUND ${room.round} · ${room.phase === 'create' ? 'PHASE 1 OF 2' : room.phase === 'solve' ? 'PHASE 2 OF 2' : 'RESULTS'}`}</div>{room.deadline && <div className={`timer ${seconds <= 10 ? 'urgent' : ''}`} role="timer" aria-label={`${seconds} seconds remaining`}>{seconds}<small>s</small></div>}</div>
        {room.phase === 'lobby' && <><Minus small/><h2>The nightmare awaits.</h2><p>Share your room code with 1–5 friends.<br/>The host starts when your crew is here.</p><p className="mode">{'♥'.repeat(room.lives)} {room.lives === 1 ? 'Nightmare' : room.lives === 2 ? 'Challenge' : 'Practice'} Mode · {room.lives} {room.lives === 1 ? 'life' : 'lives'} each</p><button className="secondary" disabled={busy} onClick={() => action('ready')}>{room.players.find(p => p.id === room.me.id)?.ready ? '✓ Ready! Click to undo' : 'I’m ready'}</button>{host ? <button className="primary full" disabled={busy || room.players.filter(p => p.online).length < 2} onClick={() => action('start')}>Start the nightmare →</button> : <p className="fine">Waiting for {room.players.find(p => p.id === room.host)?.name} to start…</p>}<p className="fine">At least 2 players required · Maximum 6</p></>}
        {playing && (room.me.lives <= 0 ? <><Minus small/><h2>You’re spectating.</h2><p>Your nightmare is over, but the showdown continues.<br/>Follow your friends on the live scoreboard.</p></> : <><h2>{room.phase === 'create' ? 'Make it negative.' : 'Solve their problem.'}</h2><p>{room.phase === 'create' ? 'Fill every box to reach your target.' : `A challenge from ${room.me.problem?.author}. What does it equal?`}</p>{room.phase === 'create' && <div className="target"><span>YOUR SECRET TARGET</span><strong>{display(room.me.target!)}</strong></div>}<form key={room.phaseId} onSubmit={e => { e.preventDefault(); const inputs = room.phase === 'create' ? values.slice(0, room.rules.count) : [answer]; if (inputs.some(v => !/^-?\d+$/.test(v))) { setError('Fill each box with a whole number. Use - for a negative number.'); return; } action('submit', room.phase === 'create' ? { phaseId: room.phaseId, values: inputs.map(Number) } : { phaseId: room.phaseId, answer: Number(answer) }); }}>
          <fieldset disabled={busy || room.me.submitted || seconds === 0}><div className="equation">{room.phase === 'create' ? Array.from({ length: room.rules.count }, (_, i) => <Fragment key={i}>{i > 0 && <span>{room.rules.operators[i - 1] === '-' ? '−' : '+'}</span>}<input aria-label={`Number ${i + 1}`} type="text" inputMode="text" autoComplete="off" placeholder="?" value={values[i]} onChange={e => setValues(v => v.map((x,j) => j === i ? e.target.value : x))}/></Fragment>) : room.me.problem?.values.map((v,i) => <Fragment key={i}>{i > 0 && <span>{room.me.problem!.operators[i - 1] === '-' ? '−' : '+'}</span>}<strong>{v < 0 ? `(${display(v)})` : v}</strong></Fragment>)}<span>=</span>{room.phase === 'create' ? <strong>{display(room.me.target!)}</strong> : <input aria-label="Your answer" type="text" inputMode="text" autoComplete="off" placeholder="?" value={answer} onChange={e => setAnswer(e.target.value)}/>}</div><button className="primary full" type="submit">{room.me.submitted ? '✓ Locked in. Waiting for the crew…' : 'Lock in answer →'}</button></fieldset></form><p className="fine">{room.phase === 'create' ? `Use whole numbers from −${room.rules.range} to ${room.rules.range}. ` : ''}One submission per phase. Wrong or late = −1 life.</p><div className="progress"><div style={{ width: `${seconds / 30 * 100}%` }}/></div></>)}
        {room.phase === 'results' && <><Minus small/><h2>{room.me.feedback?.reason ?? 'Watching the showdown'}</h2>{room.me.feedback && <p className={room.me.feedback.correct ? 'positive' : 'negative'}>{room.me.feedback.correct ? 'Nicely done. You kept your life.' : `One life lost. The correct result was ${display(room.me.feedback.answer)}.`}</p>}<p>{room.me.lives <= 0 ? 'You’re now a spectator.' : room.suddenDeath ? 'Tied survivors return with one life.' : 'Take a breath. The next phase is coming.'}</p><p className="fine">Continuing in {seconds}s…</p></>}
        {room.phase === 'finished' && <><div className="trophy">★</div><h2>{winner ? `${winner.name} wins!` : 'The room is empty.'}</h2><p>{room.winner === room.me.id ? 'You conquered the Negative Nightmare!' : 'A magnificent mathematical showdown.'}</p>{room.me.feedback && <p className="fine">{room.me.feedback.reason} · Correct result: {display(room.me.feedback.answer)}</p>}{host ? <button className="primary full" disabled={busy || room.players.filter(p => p.online).length < 2} onClick={() => action('rematch')}>Play again in this room →</button> : <p>Waiting for the host to start a rematch.</p>}</>}
      </section><aside className="card scoreboard"><div className="eyebrow">LIVE SCOREBOARD</div><h2>Your crew <span>{room.players.length}/6</span></h2><div className="player-list">{room.players.map((p,i) => <div key={p.id} className={`player ${p.lives === 0 ? 'eliminated' : ''}`}><div className={`avatar color-${i}`}>{p.name.slice(0,1).toUpperCase()}</div><div className="player-name"><strong>{p.name}{p.id === room.me.id && <small> YOU</small>}</strong><span>{p.id === room.host ? 'Host · ' : ''}{!p.online ? 'Reconnecting' : room.phase === 'lobby' ? p.ready ? 'Ready ✓' : 'Getting ready' : p.lives <= 0 ? 'Spectating' : p.submitted && playing ? 'Answer locked ✓' : 'In the game'}</span></div><div className="hearts" aria-label={`${p.lives} lives`}>{'♥'.repeat(p.lives)}<span>{'♡'.repeat(Math.max(0, room.lives - p.lives))}</span></div></div>)}</div><div className="minus-tip"><Minus small/><p><b>Minus says</b><br/>{room.phase === 'lobby' ? 'A negative number is just the beginning of something positive.' : 'Remember: subtracting a negative means adding!'}</p></div></aside></div>
    </>}
    {error && <div className="error" role="alert">{error}<button aria-label="Dismiss message" onClick={() => setError('')}>×</button></div>}
    <footer><span>MathCon: Negative Nightmare</span><span>Small numbers. Big brain energy.</span><a href="https://github.com/whitten-codex/mathcon-negative-nightmare" target="_blank" rel="noreferrer">Source on GitHub ↗</a></footer>
  </main>;
}



