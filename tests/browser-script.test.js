// Executes the actual browser bundle against a small DOM adapter. This verifies
// app event wiring, not browser rendering, native IME, or audible sound.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {browserBundle} from '../build.mjs';
import {sets} from '../practice-data.js';
import {adminUid} from '../firebase-config.js';
import {physicalCode,isCorrect} from '../core.js';
import {physicalCode as successfulCode,isCorrect as successfulCorrect} from './fixtures/shift-v20261031.4.js';
const bundle=await readFile(new URL('../app.bundle.js',import.meta.url),'utf8');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.className='';this.textContent='';this.hidden=false;this.disabled=false;this.attributes={};this.classList={add:(...names)=>{this.className=[...new Set([...this.className.split(' ').filter(Boolean),...names])].join(' ');},remove:name=>{this.className=this.className.split(' ').filter(n=>n!==name).join(' ');}};}
 append(...elements){this.children.push(...elements);}
 replaceChildren(...elements){this.children=elements;}
 setAttribute(k,v){this.attributes[k]=v;}
 blur(){}
 pause(){this.paused=true;}
 play(){this.paused=false;return Promise.resolve();}
 showModal(){this.open=true;}
 close(){this.open=false;}
 click(){this.onclick?.();}
 remove(){}
 get lastElementChild(){return this.children.at(-1);}
}
const testUser={uid:'test-student',email:'learner@example.com'};
async function app(storage=new Map(),initialUser=testUser,cloudData={profiles:[],visits:[]}){
 const ids=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 const translated=[...html.matchAll(/data-i18n="([^"]+)"/g)].map(m=>{const e=new Element();e.dataset.i18n=m[1];return e;});
 const languages=['ko','my','vi'].map(lang=>{const e=new Element('button');e.dataset.lang=lang;return e;});
 const listeners={},win={},sounds=[];
 const document={documentElement:{},body:new Element(),querySelector:s=>ids.get(s.slice(1)),querySelectorAll:s=>s==='[data-i18n]'?translated:languages,createElement:t=>new Element(t),addEventListener:(k,f)=>listeners[k]=f};
 class AudioContext{constructor(){this.state='running';this.currentTime=0;}createOscillator(){return {frequency:{},connect(){},start(){sounds.push('beep');},stop(){}};}createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}}
 let receiveUser,logoutFailure=false;
 const authControls={changeUser:user=>receiveUser(user),failLogout:()=>logoutFailure=true};
 const testGoogleAuth=(config,onUser,onError)=>{receiveUser=onUser;return {init:()=>cloudData.authFailure?onError({code:cloudData.authFailure}):onUser(initialUser),login:async()=>onUser(testUser),logout:async()=>{if(logoutFailure)throw Object.assign(Error('offline'),{code:'auth/network-request-failed'});onUser(null);}};};
const fakeSessionStorage=new Map();
 const testPracticeCloud=()=>({
  profile:async u=>cloudData.needsNickname?null:({uid:u.uid,nickname:'학생',shortId:u.uid.slice(-4)}),
  startVisit:async(u,p,id)=>({id:id||'visit-'+u.uid,uid:u.uid}),
  checkpoint:async()=>{},register:async(u,name)=>({uid:u.uid,nickname:name,shortId:u.uid.slice(-4)}),
  rankingVisits:async()=>cloudData.visits,visitsFor:async uid=>cloudData.visits.filter(v=>v.uid===uid),adminData:async()=>cloudData
 });
 const context={testPracticeCloud,setInterval(){},sessionStorage:{getItem:k=>fakeSessionStorage.get(k)||null,setItem:(k,v)=>fakeSessionStorage.set(k,v),removeItem:k=>fakeSessionStorage.delete(k)},testGoogleAuth,document,window:{location:{assign:url=>authControls.webUrl=url},addEventListener:(k,f)=>win[k]=f},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},Option:class extends Element{constructor(text,value){super('option');this.textContent=text;this.value=String(value);}},AudioContext,Blob,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},setTimeout(){},confirm:()=>true};
 vm.runInNewContext(bundle.replace('const googleAuth=createGoogleAuth(', 'const googleAuth=testGoogleAuth(').replace('const practiceCloud=createPracticeCloud(', 'const practiceCloud=testPracticeCloud('),context,{filename:'app.bundle.js'});
 await new Promise(resolve=>setImmediate(resolve));
 const el=id=>ids.get(id);
 function key(type,code,options={}){const e={code,shiftKey:false,repeat:false,preventDefault(){this.defaultPrevented=true;},...options};listeners[type](e);return e;}
 function tap(code,options={}){key('keydown',code,options);key('keyup',code,options);}
 function selectSet(n){el('setSelect').onchange({target:{value:String(n)}});}
 return {el,storage,auth:authControls,languages,sounds,key,tap,selectSet,win,start:()=>el('start').onclick(),saved:()=>JSON.parse(storage.get('hangul-key.session.v1:user:test-student'))};
}
test('file:// entry uses a classic script and bundle matches sources',async()=>{
 assert.match(html,/<script defer src="app\.bundle\.js(?:\?v=[\w.-]+)?"><\/script>/);assert.doesNotMatch(html,/type="module"/);
 assert.equal(bundle,await browserBundle());new vm.Script(bundle);
});
test('startup populates all controls, keyboard, target and music without a module loader',async()=>{
 const a=await app();assert.equal(a.el('loadWarning').hidden,true);assert.equal(a.el('setSelect').children.length,10);assert.equal(a.el('keyChoices').children.length,4);assert.equal(a.el('targetChar').textContent,'ㄹ');assert.equal(a.el('keyboard').children.length,5);assert.equal(a.el('trackSelect').children.length,4);assert.equal(a.el('audio').src,'music/track1.mp3');assert.equal(a.saved().startedAt,null);
});
test('app ignores held-key repeats, handles IME Process once, wraps at 20 and keeps wrong character',async()=>{
 const a=await app();a.start();a.key('keydown','KeyF',{key:'Process',isComposing:true,keyCode:229});a.key('keydown','KeyF',{repeat:true});a.key('keydown','KeyF');a.key('keyup','KeyF');assert.equal(a.saved().records['1:KeyF'].length,1);
 for(let i=0;i<18;i++)a.tap('KeyF');a.tap('KeyG');assert.equal(a.saved().records['1:KeyF'].length,20);assert.equal(a.el('resultRows').children.length,2);assert.equal(a.el('resultRows').children[0].children[19].textContent,'ㅎ');assert.match(a.el('resultRows').children[0].children[19].className,/wrong/);assert.equal(a.sounds.length,1);
 a.tap('Backspace');a.tap('Enter');assert.equal(a.saved().records['1:KeyF'].length,20);a.tap('KeyF');assert.equal(a.el('resultRows').children[1].children[0].textContent,'ㄹ');
});
test('UI checks correct Shift side even when output vowel is unchanged',async()=>{
 const a=await app();a.selectSet(10);a.start();a.tap('ShiftLeft');assert.equal(a.saved().startedAt,null);a.tap('KeyY');a.key('keydown','ShiftRight',{shiftKey:true});a.tap('KeyY',{shiftKey:true});a.key('keyup','ShiftRight');a.key('keydown','ShiftLeft',{shiftKey:true});a.tap('KeyY',{shiftKey:true});a.key('keyup','ShiftLeft');
 assert.deepEqual(a.saved().records['10:KeyY'].map(e=>[e.char,e.correct]),[['ㅛ',false],['ㅛ',false],['ㅛ',true]]);
});
test('target changes preserve records, reload restores them, logout ends practice',async()=>{
 const a=await app();a.start();a.tap('KeyF');a.selectSet(2);a.start();a.tap('KeyJ');
 const b=await app(a.storage);assert.equal(b.el('targetChar').textContent,'ㅓ');b.selectSet(1);assert.equal(b.el('resultRows').children[0].children[0].textContent,'ㄹ');await b.el('logout').onclick();assert.ok(b.saved().endedAt);assert.equal(b.el('practiceMain').hidden,false);b.start();b.tap('KeyF');assert.equal(b.saved().records['1:KeyF'].length,1);
});
test('all three language buttons render translated controls',async()=>{
 const a=await app();for(const button of a.languages){button.onclick();assert.equal(a.el('setSelect').children.length,10);assert.ok(a.el('title').textContent);assert.ok(a.el('finger').textContent);assert.ok(a.el('rhythm').textContent);}
});
test('TXT save opens all targets without ending practice, and restart clears only current records',async()=>{
 const a=await app();a.start();a.tap('KeyF');a.selectSet(2);a.start();a.tap('KeyJ');a.el('finish').onclick();
 assert.equal(a.saved().endedAt,null);assert.equal(a.el('recordViewer').open,true);
 assert.match(a.el('recordText').textContent,/기본자리 왼손 "ㄹ"/);assert.match(a.el('recordText').textContent,/기본자리 오른손 "ㅓ"/);assert.match(a.el('recordText').textContent,/연습 상태: 진행 중/);
 a.el('dismissRecords').onclick();a.start();a.tap('KeyJ');assert.equal(a.saved().records['2:KeyJ'].length,2);
 await a.el('restart').onclick();assert.equal(a.saved().startedAt,null);assert.deepEqual(a.saved().records,{});
});
test('starting while the correct Shift is already held preserves its physical side',async()=>{
 for(const [set,shift,code,id] of [[9,'ShiftRight','KeyQ','9:KeyQ'],[10,'ShiftLeft','KeyY','10:KeyY']]){
  const a=await app();a.selectSet(set);a.key('keydown',shift,{key:'Shift',location:shift==='ShiftRight'?2:1,shiftKey:true});a.start();a.tap(code,{shiftKey:true});
  assert.equal(a.saved().records[id][0].correct,true,`set ${set}: Shift held before Start`);
 }
});
test('all set 9/10 targets: correct side succeeds; no Shift, wrong side and both fail',async()=>{
 for(const set of sets.slice(8))for(const [i,target] of set.keys.entries()){
  const a=await app();a.selectSet(set.id);a.el('keyChoices').children[i].onclick();a.start();
  const wrong=target.shift==='ShiftLeft'?'ShiftRight':'ShiftLeft';
  a.tap(target.code);
  a.key('keydown',wrong,{shiftKey:true});a.tap(target.code,{shiftKey:true});a.key('keyup',wrong);
  a.key('keydown',target.shift,{shiftKey:true});a.tap(target.code,{shiftKey:true});
  a.key('keydown',wrong,{shiftKey:true});a.tap(target.code,{shiftKey:true});a.key('keyup',wrong);a.key('keyup',target.shift);
  a.key('keydown',target.shift,{shiftKey:true});a.tap(target.code,{key:'Process',keyCode:229,isComposing:true,shiftKey:true});a.key('keyup',target.shift);
  assert.deepEqual(a.saved().records[target.id].map(e=>e.correct),[false,false,true,false,true],target.id);
  assert.equal(a.saved().records[target.id][2].char,target.char);
 }
});
test('generic IME Shift codes use location; keycaps stay pressed until release and reset on blur',async()=>{
 const a=await app();a.selectSet(9);a.start();
 const cap=code=>a.el('keyboard').children.flatMap(row=>row.children).find(el=>el.dataset.code===code);
 a.key('keydown','Shift',{key:'Shift',keyCode:16,location:2,shiftKey:true});
 assert.match(cap('ShiftRight').className,/pressed/);assert.doesNotMatch(cap('ShiftLeft').className,/pressed/);
 a.tap('KeyQ',{shiftKey:true});assert.equal(a.saved().records['9:KeyQ'][0].correct,true);assert.match(cap('ShiftRight').className,/pressed/);
 a.key('keyup','Shift',{key:'Shift',keyCode:16,location:2});assert.doesNotMatch(cap('ShiftRight').className,/pressed/);
 a.selectSet(10);a.start();a.key('keydown','Shift',{key:'Shift',location:1,shiftKey:true});a.tap('KeyY',{shiftKey:true});assert.equal(a.saved().records['10:KeyY'][0].correct,true);assert.match(cap('ShiftLeft').className,/pressed/);
 a.win.blur();assert.doesNotMatch(cap('ShiftLeft').className,/pressed/);
});
test('Shift diagnostics expose received key metadata for both sides without counting Shift',async()=>{
 const a=await app();a.selectSet(9);a.start();
 a.tap('ShiftLeft',{key:'Shift',location:1,keyCode:16,shiftKey:true});
 a.tap('ShiftRight',{key:'Shift',location:2,keyCode:16,shiftKey:true});
 assert.match(a.el('inputTrace').textContent,/code="ShiftLeft" location=1/);
 assert.match(a.el('inputTrace').textContent,/code="ShiftRight" location=2/);
 assert.equal(a.el('inputBuild').textContent,'v20261031.shift6');
 assert.equal(a.saved().startedAt,null);
});
const teacherRight={key:'Shift',location:0,keyCode:16,shiftKey:true};
function calibrateTeacher(a){
 a.el('calibrateShift').onclick();
 a.key('keydown','ShiftLeft',{key:'Shift',location:1,keyCode:16,shiftKey:true});
 a.key('keyup','ShiftLeft',{key:'Shift',location:1,keyCode:16,shiftKey:false});
 a.key('keydown','',teacherRight);a.key('keyup','',{...teacherRight,shiftKey:false});
 assert.equal(a.el('shiftCalibration').open,false);
}
test('teacher PC exact unlocated Shift requires calibration and preserves right-key motion',async()=>{
 const a=await app();a.selectSet(9);a.start();a.key('keydown','',teacherRight);a.tap('KeyQ',{key:'Process',keyCode:229,shiftKey:true});a.key('keyup','',{...teacherRight,shiftKey:false});
 assert.equal(a.saved().records['9:KeyQ'],undefined);assert.equal(a.el('shiftCalibration').open,true);
 a.el('cancelCalibration').onclick();calibrateTeacher(a);assert.equal(a.storage.get('hangul-key.shift-profile.v1'),'unlocated-right');
 a.start();a.key('keydown','',teacherRight);
 const cap=a.el('keyboard').children.flatMap(row=>row.children).find(el=>el.dataset.code==='ShiftRight');assert.match(cap.className,/pressed/);
 a.key('keydown','KeyQ',{key:'Process',keyCode:229,shiftKey:true});
 a.key('keyup','KeyQ',{key:'Process',keyCode:229,shiftKey:true,isComposing:true});
 a.key('keyup','KeyQ',{key:'Q',keyCode:81,shiftKey:true,isComposing:true});
 a.key('keyup','ShiftRight',{key:'Process',location:2,keyCode:229,shiftKey:false,isComposing:true});
 a.key('keyup','',{...teacherRight,shiftKey:false,isComposing:true});
 assert.doesNotMatch(cap.className,/pressed/);
 assert.deepEqual(a.saved().records['9:KeyQ'].map(e=>e.correct),[true]);
 const b=await app(a.storage);b.start();b.key('keydown','',teacherRight);b.tap('KeyQ',{shiftKey:true});assert.equal(b.saved().records['9:KeyQ'].at(-1).correct,true);
});
test('calibrated teacher signals correctly distinguish all set 9 and 10 targets',async()=>{
 const a=await app();a.selectSet(9);calibrateTeacher(a);
 for(const set of sets.slice(8))for(const [i,target] of set.keys.entries()){
  a.selectSet(set.id);a.el('keyChoices').children[i].onclick();a.start();
  a.tap(target.code);
  a.key('keydown','',teacherRight);a.tap(target.code,{key:'Process',keyCode:229,shiftKey:true});a.key('keyup','',{...teacherRight,shiftKey:false});
  a.key('keydown','ShiftLeft',{key:'Shift',location:1,shiftKey:true});a.tap(target.code,{shiftKey:true});
  a.key('keydown','',teacherRight);a.tap(target.code,{shiftKey:true});a.key('keyup','',{...teacherRight,shiftKey:true});a.key('keyup','ShiftLeft');
  assert.deepEqual(a.saved().records[target.id].map(e=>e.correct),[false,set.id===9,set.id===10,false],target.id);
 }
});
test('calibration cancellation and ambiguous left Shift do not register a profile',async()=>{
 const a=await app();a.el('calibrateShift').onclick();a.tap('',teacherRight);assert.equal(a.storage.has('hangul-key.shift-profile.v1'),false);assert.equal(a.el('shiftCalibration').open,true);
 a.el('cancelCalibration').onclick();assert.equal(a.el('shiftCalibration').open,false);assert.equal(a.storage.has('hangul-key.shift-profile.v1'),false);
});
test('unrecognized Shift automatically opens setup, then the same signal succeeds',async()=>{
 const a=await app();a.selectSet(9);a.start();a.key('keydown','',teacherRight);
 assert.equal(a.el('shiftCalibration').open,true);a.key('keyup','',{...teacherRight,shiftKey:false});
 a.tap('ShiftLeft',{key:'Shift',location:1,keyCode:16,shiftKey:true});
 a.key('keydown','',teacherRight);a.key('keyup','',{...teacherRight,shiftKey:false});
 assert.equal(a.el('shiftCalibration').open,false);assert.equal(a.saved().startedAt,null);
 a.start();a.key('keydown','',teacherRight);a.tap('KeyQ',{shiftKey:true});a.key('keyup','',{...teacherRight,shiftKey:false});
 assert.equal(a.saved().records['9:KeyQ'][0].correct,true);
});

test('restored Shift normalizer and judgment match the recovered successful source',()=>{
 const signals=[
  {key:'Shift',code:'ShiftLeft',location:1,keyCode:16,shiftKey:true},
  {key:'Shift',code:'',location:0,keyCode:16,shiftKey:true},
  {key:'Process',code:'KeyE',location:0,keyCode:229,shiftKey:true,isComposing:false},
  {key:'Process',code:'KeyE',location:0,keyCode:229,shiftKey:true,isComposing:true},
  {key:'E',code:'KeyE',location:0,keyCode:69,shiftKey:true,isComposing:true},
  {key:'Process',code:'ShiftRight',location:2,keyCode:229,shiftKey:false,isComposing:true},
  {key:'Shift',code:'',location:0,keyCode:16,shiftKey:false,isComposing:true}
 ];
 for(const profile of ['standard','unlocated-right'])for(const signal of signals)assert.equal(physicalCode(signal,profile),successfulCode(signal,profile));
 for(const target of sets.slice(8).flatMap(s=>s.keys))for(const held of [[],['ShiftLeft'],['ShiftRight'],['ShiftLeft','ShiftRight']]){
  assert.equal(isCorrect(target,target.code,new Set(held),true),successfulCorrect(target,target.code,new Set(held),true));
 }
});

test('known working profile applies from stuck step 2, survives reload and login, and uses actual Shift side',async()=>{
 const oldFileStorage=new Map([['hangul-key.shift-profile.v1','unlocated-right']]);
 const webStorage=new Map();const a=await app(webStorage);a.selectSet(9);
 assert.notEqual(a.el('shiftProfile').textContent,(await app(oldFileStorage)).el('shiftProfile').textContent);
 a.el('calibrateShift').onclick();a.tap('ShiftLeft',{key:'Shift',location:1,keyCode:16});
 a.el('applyKnownShift').onclick();assert.equal(a.el('shiftCalibration').open,false);
 assert.equal(webStorage.get('hangul-key.shift-profile.v1'),'unlocated-right');
 for(const set of sets.slice(8))for(const [i,target] of set.keys.entries()){
  a.selectSet(set.id);a.el('keyChoices').children[i].onclick();a.start();
  a.key('keydown','',teacherRight);
  const cap=a.el('keyboard').children.flatMap(row=>row.children).find(el=>el.dataset.code==='ShiftRight');assert.match(cap.className,/pressed/);
  a.tap(target.code,{key:'Process',keyCode:229,isComposing:true,shiftKey:true});
  a.key('keyup','ShiftRight',{key:'Process',keyCode:229,location:2,shiftKey:false,isComposing:true});
  a.key('keyup','',{...teacherRight,shiftKey:false,isComposing:true});assert.doesNotMatch(cap.className,/pressed/);
  a.key('keydown','ShiftLeft',{key:'Shift',location:1,shiftKey:true});a.tap(target.code,{shiftKey:true});a.key('keyup','ShiftLeft');
  assert.deepEqual(a.saved().records[target.id].map(e=>e.correct),[set.id===9,set.id===10]);
 }
 const b=await app(webStorage);b.selectSet(9);b.start();b.key('keydown','',teacherRight);b.tap('KeyQ',{shiftKey:true});b.key('keyup','',{...teacherRight,shiftKey:false});
 assert.equal(b.saved().records['9:KeyQ'].at(-1).correct,true);
 b.auth.changeUser(null);await b.el('login').onclick();b.selectSet(9);b.start();b.key('keydown','',teacherRight);b.tap('KeyQ',{shiftKey:true});
 assert.equal(b.saved().records['9:KeyQ'].at(-1).correct,true);
});

test('guests can practice locally; Login records are isolated; Logout saves end time',async()=>{
 const a=await app(new Map(),null);assert.equal(a.el('practiceMain').hidden,false);assert.equal(a.el('authGate').hidden,false);
 a.start();a.tap('KeyF');assert.equal(JSON.parse(a.storage.get('hangul-key.guest.v1')).records['1:KeyF'].length,1);
 await a.el('login').onclick();await new Promise(resolve=>setImmediate(resolve));assert.equal(a.el('practiceMain').hidden,false);a.start();a.tap('KeyF');
 await a.el('logout').onclick();assert.ok(a.saved().endedAt);assert.equal(a.el('practiceMain').hidden,false);a.tap('KeyF');assert.equal(a.saved().records['1:KeyF'].length,1);
});
test('Google users have isolated local records and legacy anonymous records remain untouched',async()=>{
 const storage=new Map([['hangul-key.session.v1','legacy-data']]),a=await app(storage);a.start();a.tap('KeyF');
 a.auth.changeUser({uid:'other-user',email:'other@gmail.com'});await new Promise(resolve=>setImmediate(resolve));assert.equal(a.el('counts').textContent,'입력 0회 · 오답 0회');assert.ok(a.saved().endedAt);
 a.start();a.tap('KeyF');assert.equal(JSON.parse(storage.get('hangul-key.session.v1:user:other-user')).records['1:KeyF'].length,1);
 await a.el('restart').onclick();assert.equal(JSON.parse(storage.get('hangul-key.session.v1:user:other-user')).startedAt,null);assert.equal(a.saved().records['1:KeyF'].length,1);assert.equal(storage.get('hangul-key.session.v1'),'legacy-data');
});
test('failed Auth Logout keeps the completed cloud run and user signed in for retry',async()=>{
 const a=await app();a.start();a.tap('KeyF');a.auth.failLogout();await a.el('logout').onclick();
 assert.ok(a.saved().endedAt);assert.equal(a.el('practiceMain').hidden,false);assert.equal(a.el('authError').hidden,false);
});
test('first Google login requires nickname, then account shows alias and UID suffix',async()=>{
 const a=await app(new Map(),testUser,{profiles:[],visits:[],needsNickname:true});assert.equal(a.el('nicknameDialog').open,true);assert.equal(a.el('start').disabled,true);
 a.el('nicknameInput').value='중복가능';await a.el('nicknameSave').onclick();assert.equal(a.el('nicknameDialog').open,false);assert.equal(a.el('userEmail').textContent,'중복가능(dent)');assert.equal(a.el('start').disabled,false);
});
test('top five ranks drill into per-login dates, counts and score, and hide admin UI from students',async()=>{
 const visits=Array.from({length:7},(_,i)=>({uid:'s'+i,nickname:'학생',shortId:'000'+i,durationMs:i*1000,totalInputs:10,totalErrors:2,score:6,loginAt:'2026-10-31T01:00:00Z',firstInputAt:'2026-10-31T01:00:01Z',logoutAt:null}));
 visits.push({uid:adminUid,nickname:'관리자',shortId:'ey43',durationMs:999999,totalInputs:100,totalErrors:0});
 const a=await app(new Map(),testUser,{profiles:[],visits});assert.equal(a.el('admin').hidden,true);await a.el('ranking').onclick();
 const table=a.el('communityBody').children[0];assert.equal(table.children.length,6);const first=table.children[1].children[1].children[0];assert.equal(first.textContent,'학생(0006)');await first.onclick();
 assert.match(a.el('communityBody').children[0].textContent,/접속 1회/);assert.match(a.el('communityBody').children[0].textContent,/6점/);assert.equal(a.el('communityBody').children[1].children.length,2);
});
test('only owner UID sees admin mode; all registered students include those with zero practice',async()=>{
 const p={uid:'s0001',nickname:'아직연습전',shortId:'0001'},a=await app(new Map(),{uid:adminUid,email:'teacher@example.com'},{profiles:[p],visits:[]});
 assert.equal(a.el('admin').hidden,false);await a.el('admin').onclick();assert.equal(a.el('communityBody').children[0].children.length,2);
});
test('file launch offers explicit web Login navigation while guest practice stays available',async()=>{
 const a=await app(new Map(),null,{profiles:[],visits:[],authFailure:'app/http-required'});
 assert.equal(a.el('login').disabled,false);assert.equal(a.el('login').textContent,'웹 주소에서 Login');assert.equal(a.el('practiceMain').hidden,false);
 await a.el('login').onclick();assert.equal(a.auth.webUrl,'http://localhost:8765/');
});
