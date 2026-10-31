import {base,shifted,sets} from './practice-data.js';
export function newSession(){return {version:1,runId:globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),startedAt:null,endedAt:null,selected:sets[0].keys[0].id,records:{}};}
export function targetById(id){return sets.flatMap(s=>s.keys).find(k=>k.id===id);}
export function character(code,shift=false){return (shift?shifted[code]:null)||base[code]||null;}
export function physicalCode(event,shiftProfile='standard'){
  // Use the explicit left/right location when a browser/IME reports a generic
  // Shift code. Never infer the side merely from shiftKey or the output glyph.
  if(event.key==='Shift'||event.keyCode===16||['ShiftLeft','ShiftRight'].includes(event.code)){
    if(event.location===1)return 'ShiftLeft';
    if(event.location===2)return 'ShiftRight';
    if(!['ShiftLeft','ShiftRight'].includes(event.code))return shiftProfile==='unlocated-right'?'ShiftRight':'ShiftUnknown';
  }
  return event.code;
}
export function isCorrect(target,code,pressed,shiftKey=false){
  const left=pressed.has('ShiftLeft'),right=pressed.has('ShiftRight');
  return code===target.code && (target.shift ? pressed.has(target.shift) && !(target.shift==='ShiftLeft'?right:left) : !left&&!right&&!shiftKey);
}
export function record(session,target,char,correct,now=new Date()){
  if(session.endedAt)return false;
  session.startedAt ||= now.toISOString();
  (session.records[target.id] ||= []).push({char,correct});return true;
}
export function rows(entries){return Array.from({length:Math.ceil(entries.length/20)},(_,i)=>entries.slice(i*20,i*20+20));}
export function timeLabel(iso){if(!iso)return '—';const d=new Date(iso),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}.${p(d.getMonth()+1)}.${p(d.getDate())}.${p(d.getHours())}:${p(d.getMinutes())}`;}
export function filename(session){return timeLabel(session.startedAt||session.endedAt).replaceAll('.','').replace(':','').replace(/(\d{8})(\d{4})/,'$1_$2')+'.txt';}
export function exportText(session){
 const out=[`연습 시작 시간: ${timeLabel(session.startedAt)}`,''];
 for(const set of sets)for(const key of set.keys){const entries=session.records[key.id];if(!entries?.length)continue;out.push(`${set.name} "${key.char}"`);for(const row of rows(entries))out.push(`${row.map(e=>e.char).join('')} : -${row.filter(e=>!e.correct).length}`);out.push('');}
 out.push(session.endedAt?`연습 종료 시간: ${timeLabel(session.endedAt)}`:'연습 상태: 진행 중');return out.join('\r\n');
}
export function restore(raw){
 const s=JSON.parse(raw);if(s?.version!==1||!targetById(s.selected)||!s.records||typeof s.records!=='object'||Array.isArray(s.records))throw Error('Invalid session');
 for(const field of ['startedAt','endedAt'])if(s[field]!==null&&(typeof s[field]!=='string'||!Number.isFinite(Date.parse(s[field]))))throw Error('Invalid date');
 let count=0;for(const [id,entries] of Object.entries(s.records)){if(!targetById(id)||!Array.isArray(entries)||entries.some(e=>!e||typeof e.char!=='string'||[...e.char].length!==1||typeof e.correct!=='boolean'))throw Error('Invalid record');count+=entries.length;}
 if((count>0)!==Boolean(s.startedAt)||s.endedAt&&!s.startedAt)throw Error('Invalid timing');return s;
}
