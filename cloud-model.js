export function practiceScore(inputs,errors){return Math.max(0,inputs-2*errors);}
export function sessionCounts(session){
 let inputs=0,errors=0;for(const entries of Object.values(session.records||{})){inputs+=entries.length;errors+=entries.filter(e=>!e.correct).length;}
 return {inputs,errors};
}
export function studentLabel(profile){return `${profile.nickname}(${profile.shortId})`;}
export function normalizeNickname(value){const name=String(value||'').trim();if(!name||[...name].length>20||/[\u0000-\u001f\u007f]/.test(name))throw Error('nickname-invalid');return name;}
export function timestampMs(value){return value?.toMillis?.()??(typeof value==='number'?value:typeof value==='string'?Date.parse(value):0);}
export function visitDuration(visit){
 const first=timestampMs(visit.firstInputAt),last=timestampMs(visit.logoutAt||visit.lastSeenAt);
 return first&&last?Math.max(0,last-first):(visit.durationMs||0);
}
export function studentTotals(visits,profiles=[],adminUid=''){
 const users=new Map(profiles.filter(p=>p.uid!==adminUid).map(p=>[p.uid,{...p,visits:0,totalMs:0,inputs:0,errors:0,score:0}]));
 for(const visit of visits){if(visit.uid===adminUid)continue;let u=users.get(visit.uid);if(!u){u={uid:visit.uid,nickname:visit.nickname,shortId:visit.shortId,visits:0,totalMs:0,inputs:0,errors:0};users.set(visit.uid,u);}u.visits++;u.totalMs+=visitDuration(visit);u.inputs+=visit.totalInputs||0;u.errors+=visit.totalErrors||0;}
 return [...users.values()].map(u=>({...u,score:practiceScore(u.inputs,u.errors)})).sort((a,b)=>b.totalMs-a.totalMs||a.uid.localeCompare(b.uid));
}
export function resultChunks(session,size=1000){
 const result=[];for(const [targetId,entries] of Object.entries(session.records||{}))for(let start=0;start<entries.length;start+=size)result.push({id:targetId.replace(':','_')+'_'+start,targetId,start,entries:entries.slice(start,start+size)});return result;
}
