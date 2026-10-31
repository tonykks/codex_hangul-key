import test from 'node:test';
import assert from 'node:assert/strict';
import {createPracticeCloud} from '../cloud.js';
import {practiceScore,normalizeNickname,studentTotals,resultChunks,studentLabel,visitDuration} from '../cloud-model.js';
import {newSession} from '../core.js';
function fakeStore(){
 const data=new Map();let next=0,fail=false;
 class Stamp{constructor(ms){this.ms=ms;}toMillis(){return this.ms;}}
 function clone(v){if(v instanceof Stamp)return new Stamp(v.ms);if(v?.server)return new Stamp(Date.now());if(Array.isArray(v))return v.map(clone);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,clone(x)]));return v;}
 const snap=r=>({exists:()=>data.has(r.path),data:()=>clone(data.get(r.path))});
 const apply=ops=>{if(fail){fail=false;throw Error('offline');}for(const [op,r,v] of ops)data.set(r.path,op==='update'?{...data.get(r.path),...clone(v)}:clone(v));};
 const sdk={getApps:()=>[{}],getApp:()=>({}),getFirestore:()=>({}),serverTimestamp:()=>({server:true}),
  collection:(db,...parts)=>({path:parts.join('/')}),doc:(db,...parts)=>parts.length?{path:parts.join('/')}:{path:db.path+'/visit'+(++next),id:'visit'+next},
  getDoc:async r=>snap(r),setDoc:async(r,v)=>apply([['set',r,v]]),
  runTransaction:async(db,fn)=>{const ops=[];await fn({get:async r=>snap(r),set:(r,v)=>ops.push(['set',r,v]),update:(r,v)=>ops.push(['update',r,v])});apply(ops);},
  writeBatch:()=>{const ops=[];return {set:(r,v)=>ops.push(['set',r,v]),commit:async()=>apply(ops)};},
  where:(field,op,value)=>({field,op,value}),query:(c,...filters)=>({...c,filters}),
  getDocs:async q=>({docs:[...data].filter(([p,v])=>p.startsWith(q.path+'/')&&p.split('/').length===q.path.split('/').length+1&&(q.filters||[]).every(f=>f.op==='=='?v[f.field]===f.value:v[f.field]!==f.value)).map(([path,v])=>({id:path.split('/').at(-1),data:()=>clone(v)}))})
 };
 return {sdk,data,failNext:()=>fail=true};
}
test('score uses correct minus errors, with zero floor only after combining sessions',()=>{
 assert.equal(practiceScore(10,3),4);assert.equal(practiceScore(3,3),0);
 const t=studentTotals([{uid:'s',nickname:'같은이름',shortId:'0001',totalInputs:10,totalErrors:0,durationMs:1000},{uid:'s',nickname:'같은이름',shortId:'0001',totalInputs:10,totalErrors:10,durationMs:1000}]);assert.equal(t[0].score,0);assert.equal(t[0].visits,2);
});
test('ranking uses authoritative server timestamps, not a stale or inflated numeric cache',()=>{
 const v={uid:'student',firstInputAt:1000,logoutAt:31000,lastSeenAt:20000,durationMs:999999,totalInputs:2,totalErrors:0};
 assert.equal(visitDuration(v),30000);assert.equal(studentTotals([v])[0].totalMs,30000);assert.equal(visitDuration({...v,logoutAt:null}),19000);
});
test('same aliases stay separate by full UID; ranking is time-based and excludes admin',()=>{
 const visits=Array.from({length:7},(_,i)=>({uid:'student'+i,nickname:'별칭',shortId:String(i).padStart(4,'0'),totalInputs:10,totalErrors:0,durationMs:i*1000}));visits.push({uid:'admin',durationMs:999999,totalInputs:999});
 const top=studentTotals(visits,[],'admin').slice(0,5);assert.equal(top.length,5);assert.equal(top[0].uid,'student6');assert.equal(top[4].uid,'student2');assert.equal(studentLabel(top[0]),'별칭(0006)');
 assert.throws(()=>normalizeNickname('   '));assert.throws(()=>normalizeNickname('x'.repeat(21)));assert.equal(normalizeNickname(' 학생 '),'학생');
});
test('large unlimited practice is divided into bounded private result documents',()=>{
 const s=newSession();s.records={'1:KeyF':Array.from({length:12005},()=>({char:'ㄹ',correct:true}))};
 const chunks=resultChunks(s);assert.equal(chunks.length,13);assert.equal(chunks.at(-1).entries.length,5);assert.equal(chunks.reduce((n,c)=>n+c.entries.length,0),12005);assert.ok(chunks.every(c=>c.entries.length<=1000));
});
test('Firestore registration permits duplicate aliases and keeps immutable existing profile',async()=>{
 const m=fakeStore(),c=createPracticeCloud({},'admin',async()=>m.sdk),u={uid:'student0001'},v={uid:'student0002'};
 assert.equal((await c.register(u,'학생')).shortId,'0001');assert.equal((await c.register(v,'학생')).nickname,'학생');assert.equal((await c.register(u,'바뀐이름')).nickname,'학생');
});
test('visits count logins without typing; checkpoint retry is idempotent and reset accumulates',async()=>{
 const m=fakeStore(),c=createPracticeCloud({},'admin',async()=>m.sdk),u={uid:'student0001'},p=await c.register(u,'학생');
 const v=await c.startVisit(u,p),s=newSession();assert.equal((await c.visitsFor(u.uid))[0].firstInputAt,null);
 s.startedAt=new Date().toISOString();s.records={'1:KeyF':[{char:'ㄹ',correct:true},{char:'ㅎ',correct:false}]};
 await c.checkpoint(u,v.id,s);await c.checkpoint(u,v.id,s);
 let stored=(await c.visitsFor(u.uid))[0];assert.equal(stored.totalInputs,2);assert.equal(stored.totalErrors,1);assert.equal(stored.score,0);assert.ok(stored.firstInputAt.toMillis());
 const reset=newSession();reset.startedAt=new Date().toISOString();reset.records={'1:KeyF':[{char:'ㄹ',correct:true}]};
 await c.checkpoint(u,v.id,reset,true);stored=(await c.visitsFor(u.uid))[0];assert.equal(stored.totalInputs,3);assert.equal(stored.score,1);assert.ok(stored.logoutAt);
 assert.equal([...m.data.keys()].filter(k=>k.includes('/chunks/')).length,2);
 const second=await c.startVisit(u,p,v.id);assert.notEqual(second.id,v.id);assert.equal((await c.visitsFor(u.uid)).length,2);
});
test('open visits resume across reload, failed writes can retry without duplicate totals',async()=>{
 const m=fakeStore(),c=createPracticeCloud({},'admin',async()=>m.sdk),u={uid:'student0001'},p=await c.register(u,'학생'),v=await c.startVisit(u,p);
 assert.equal((await c.startVisit(u,p,v.id)).id,v.id);const s=newSession();s.startedAt=new Date().toISOString();s.records={'1:KeyF':[{char:'ㄹ',correct:true}]};
 m.failNext();await assert.rejects(c.checkpoint(u,v.id,s));await c.checkpoint(u,v.id,s);assert.equal((await c.visitsFor(u.uid))[0].totalInputs,1);
});
