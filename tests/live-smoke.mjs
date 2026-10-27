import assert from 'node:assert/strict';
const origin = process.argv[2] || 'http://127.0.0.1:5173';
const call = async (action,session={},extra={}) => { const res=await fetch(`${origin}/api/game`,{method:'POST',headers:{'Content-Type':'application/json',origin},body:JSON.stringify({action,...session,...extra}),signal:AbortSignal.timeout(15000)}); const data=await res.json(); if(!res.ok) throw new Error(`${action}: ${res.status} ${data.error}`);return data; };
const session = x => ({code:x.room.code,token:x.token});
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
const host=await call('create',{}, {name:'Smoke Host',lives:3}),clients=[session(host)];
console.log('Room created');
try {
  const joins=await Promise.all(Array.from({length:5},(_,i)=>call('join',{}, {code:host.room.code,name:`Smoke ${i+1}`})));
  clients.push(...joins.map(session));
  let r=(await call('poll',clients[0])).room;assert.equal(r.players.length,6);console.log('Six concurrent players connected');
  let rejected=false;try{await call('join',{}, {code:r.code,name:'Seventh'});}catch(e){rejected=/full/.test(e.message);}assert.ok(rejected);console.log('Seventh player rejected');
  await call('ready',clients[1]);
  r=(await call('start',clients[0])).room;assert.equal(r.phase,'create');
  for(let round=1;round<=2;round++) {
    const states=await Promise.all(clients.map(c=>call('poll',c)));
    assert.ok(states.every(s=>s.room.phase==='create'&&s.room.round===round));
    await Promise.all(clients.map((c,i)=>call('submit',c,{phaseId:states[i].room.phaseId,values:i===0?[0,-states[i].room.me.target]:[0,0]})));
    do{await pause(300);r=(await call('poll',clients[0])).room;}while(r.phase==='results');
    assert.equal(r.phase,'solve');
    const problems=await Promise.all(clients.map(c=>call('poll',c)));
    assert.ok(problems.every(s=>s.room.me.target===undefined));
    assert.ok(problems.every(s=>s.room.me.problem.author!==s.room.players.find(p=>p.id===s.room.me.id).name));
    await Promise.all(clients.map((c,i)=>{const s=problems[i].room,p=s.me.problem;const answer=p.values.slice(1).reduce((n,v,k)=>p.operators[k]==='+'?n+v:n-v,p.values[0]);return call('submit',c,{phaseId:s.phaseId,answer:round===2&&i!==0?999:answer});}));
    r=(await call('poll',clients[0])).room;
    console.log(`Round ${round} create and solve synchronized`);
    if(round===1){do{await pause(300);r=(await call('poll',clients[0])).room;}while(r.phase==='results');}
  }
  assert.equal(r.phase,'finished');assert.equal(r.winner,r.me.id);assert.equal(r.players.filter(p=>p.lives===0).length,5);console.log('Winner and five spectators verified');
  const restarted=(await call('rematch',clients[0])).room;assert.equal(restarted.phase,'create');assert.ok(restarted.players.every(p=>p.lives===3));console.log('Same-room rematch verified');
  console.log('LIVE MULTIPLAYER SMOKE TEST PASSED');
}finally{for(const c of clients){try{await call('leave',c);}catch{}}}
