import {sets,tracks,keyboardRows,keyLabel,base,shifted} from './practice-data.js';
import {newSession,targetById,character,physicalCode,isCorrect,record,rows,timeLabel,filename,exportText,restore} from './core.js';
import {translations} from './translations.js';
import {firebaseConfig,adminUid} from './firebase-config.js';
import {createPracticeCloud} from './cloud.js';
import {studentLabel,studentTotals,timestampMs,visitDuration} from './cloud-model.js';
import {createGoogleAuth} from './auth.js';
const $=s=>document.querySelector(s);
let storageKey='hangul-key.guest.v1',currentUser=null,authBusy=false,authReady=false,authProblem=null;
let session=newSession(),lang='ko',active=false,storageIssue='',storageBlocked=false;
try{lang=localStorage.getItem('hangul-key.language')||'ko';}catch{storageIssue='storage';}
if(!translations[lang])lang='ko';
try{const raw=localStorage.getItem(storageKey);if(raw)session=restore(raw);}catch{storageIssue='corrupt';storageBlocked=true;}
session.runId ||= newSession().runId;
let currentProfile=null,cloudVisit=null,cloudProblem=null,userGeneration=0;
const practiceCloud=createPracticeCloud(firebaseConfig,adminUid);
const pressed=new Set(),caps=new Map();let audioContext;
let shiftProfile='standard',calibration=null;
try{if(localStorage.getItem('hangul-key.shift-profile.v1')==='unlocated-right')shiftProfile='unlocated-right';}catch{}
function cancelCalibration(){calibration=null;clearPressed();$('#shiftCalibration').close();}
function beginCalibration(){pause();calibration={stage:'left-down'};$('#calibrationMessage').textContent=t('calLeft');$('#shiftCalibration').showModal();}
function finishCalibration(rightCode){
 shiftProfile=rightCode==='ShiftUnknown'?'unlocated-right':'standard';
 try{localStorage.setItem('hangul-key.shift-profile.v1',shiftProfile);}catch{storageIssue='storage';}
 cancelCalibration();render();
}
function calibrateInput(type,event){
 if(!calibration)return false;
 event.preventDefault();
 if(event.code==='Escape'){cancelCalibration();return true;}
 if(event.repeat)return true;
 const code=physicalCode(event);
 traceInput('setup-'+type,event,code);
 if(calibration.stage==='left-down'&&type==='down'){
  if(code==='ShiftLeft'){calibration.stage='left-up';$('#calibrationMessage').textContent=t('calRelease');}
  else $('#calibrationMessage').textContent=t('calLeftError');
 }else if(calibration.stage==='left-up'&&type==='up'&&code==='ShiftLeft'){
  calibration.stage='right-down';$('#calibrationMessage').textContent=t('calRight');
 }else if(calibration.stage==='right-down'&&type==='down'){
  if(['ShiftRight','ShiftUnknown'].includes(code)){calibration.rightCode=code;calibration.stage='right-up';$('#calibrationMessage').textContent=t('calRelease');}
  else $('#calibrationMessage').textContent=t('calRight');
 }else if(calibration.stage==='right-up'&&type==='up'&&(code===calibration.rightCode||code==='ShiftRight')){
  finishCalibration(calibration.rightCode);
 }
 return true;
}
const inputTrace=[];
function traceInput(type,event,code){
 inputTrace.push(`${type}: key=${JSON.stringify(event.key??'')} code=${JSON.stringify(event.code??'')} location=${event.location??0} keyCode=${event.keyCode??0} shift=${Boolean(event.shiftKey)} → ${code||'?'} [${[...pressed].join(', ')}]`);
 if(inputTrace.length>8)inputTrace.shift();
 $('#inputTrace').textContent=inputTrace.join('\n');
}
function t(k,vars={}){let value=translations[lang][k];for(const [key,val] of Object.entries(vars))value=value.replaceAll('{'+key+'}',val);return value;}
function save(){if(storageBlocked||!storageKey)return;try{localStorage.setItem(storageKey,JSON.stringify(session));}catch{storageIssue='storage';showWarning();}}
function showWarning(){const el=$('#storageWarning');el.hidden=!storageIssue;el.textContent=storageIssue?t(storageIssue):'';}
function target(){return targetById(session.selected);}
function currentSet(){return sets.find(s=>s.keys.some(k=>k.id===session.selected));}
function clearPressed(){pressed.clear();for(const cap of caps.values())cap.classList.remove('pressed');}
function pause(){active=false;clearPressed();renderStatus();}
function renderStatus(){ $('#status').textContent=t(session.endedAt?'finished':active?'active':'ready');$('#guide').hidden=active;$('#pause').hidden=!active;$('#start').disabled=Boolean(session.endedAt)||Boolean(currentUser&&!currentProfile);$('#start').hidden=active;$('#finish').disabled=!session.startedAt;$('#finish').textContent=t('saveRecords');$('#restart').disabled=authBusy||Boolean(cloudVisit?.closed);}
function renderKeyboard(){
 $('#keyboard').replaceChildren();caps.clear();const key=target();
 for(const row of keyboardRows){const line=document.createElement('div');line.className='key-row';for(const code of row){const cap=document.createElement('div');cap.className='keycap';cap.dataset.code=code;if(!base[code])cap.classList.add('wide');if(code==='Space')cap.classList.add('space');if(['KeyF','KeyJ'].includes(code))cap.classList.add('home');if(key.code===code)cap.classList.add('target');if(key.shift===code)cap.classList.add('shift-target');if(pressed.has(code))cap.classList.add('pressed');const label=document.createElement('span');label.textContent=base[code]&&code.startsWith('Key')?base[code]:code==='ShiftLeft'?t('shiftLeft'):code==='ShiftRight'?t('shiftRight'):keyLabel(code);cap.append(label);if(code.startsWith('Key')){const sub=document.createElement('small');sub.textContent=keyLabel(code)+(shifted[code]?' / '+shifted[code]:'');cap.append(sub);}line.append(cap);caps.set(code,cap);}$('#keyboard').append(line);}
}
function renderResults(){
 const entries=session.records[session.selected]||[],all=Object.values(session.records).reduce((n,a)=>n+a.length,0);
 $('#counts').textContent=t('count',{n:entries.length,e:entries.filter(e=>!e.correct).length});$('#sessionInfo').textContent=t('session',{n:all,time:timeLabel(session.startedAt)});$('#resultRows').replaceChildren();
 const lines=rows(entries);if(!session.endedAt&&entries.length%20===0)lines.push([]);
 lines.forEach((line,i)=>{const el=document.createElement('div');el.className='result-row';for(let j=0;j<20;j++){const cell=document.createElement('span');cell.className='cell';if(line[j]){cell.textContent=line[j].char===' '?'␣':line[j].char;if(!line[j].correct)cell.classList.add('wrong');}else if(j===line.length&&i===lines.length-1&&!session.endedAt)cell.classList.add('cursor');el.append(cell);}const errors=document.createElement('span');errors.className='row-errors';errors.textContent=t('errors',{n:line.filter(e=>!e.correct).length});el.append(errors);$('#resultRows').append(el);});
 const resultRows=$('#resultRows');resultRows.scrollTop=resultRows.scrollHeight;renderStatus();
}
function render(){
 document.documentElement.lang=lang;document.title=t('title');$('#title').textContent=t('title');document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));document.querySelectorAll('[data-lang]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===lang)));
 $('#setSelect').replaceChildren(...sets.map((s,i)=>new Option(`${s.id}. ${translations[lang].sets[i]}`,s.id)));$('#setSelect').value=currentSet().id;
 $('#keyChoices').replaceChildren(...currentSet().keys.map(key=>{const b=document.createElement('button');b.setAttribute('aria-pressed',String(key.id===session.selected));b.textContent=key.char;const small=document.createElement('small');small.textContent=keyLabel(key.code);b.append(small);b.onclick=()=>select(key.id);return b;}));
 const key=target();$('#targetChar').textContent=key.char;$('#targetKey').textContent=(key.shift?'Shift + ':'')+keyLabel(key.code);$('#finger').textContent=`${t(key.hand)} · ${translations[lang].fingers[key.finger]}`+(key.shift?` + ${t(key.shift==='ShiftLeft'?'shiftLeft':'shiftRight')}`:'');$('#rhythm').textContent=t(key.shift?'shiftRhythm':'rhythm');$('#purpose').textContent=t('purpose');$('#special').textContent=key.shift?t('shiftHelp'):key.code==='KeyB'?t('bHelp'):'';
 $('#inputDiagnostics').hidden=!key.shift;$('#inputBuild').textContent='v20261031.shift6';
 $('#shiftCompatibility').hidden=!key.shift;$('#shiftProfile').textContent=t(shiftProfile==='unlocated-right'?'calEnabled':'calStandard');
 showWarning();renderKeyboard();renderResults();renderAuth();
}
function select(id){pause();session.selected=id;save();render();}
function initSound(){try{audioContext ||= new AudioContext();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});}catch{}}
function beep(){if(!audioContext)return;try{const osc=audioContext.createOscillator(),gain=audioContext.createGain(),now=audioContext.currentTime;osc.frequency.value=440;gain.gain.setValueAtTime(.10,now);gain.gain.exponentialRampToValueAtTime(.001,now+.12);osc.connect(gain);gain.connect(audioContext.destination);osc.start(now);osc.stop(now+.12);}catch{}}
document.addEventListener('keydown',event=>{
 if(calibrateInput('down',event))return;
 const code=physicalCode(event,shiftProfile);
 if(code==='ShiftUnknown'&&active&&target().shift&&!session.endedAt){event.preventDefault();beginCalibration();return;}
 const already=pressed.has(code);pressed.add(code);caps.get(code)?.classList.add('pressed');
 traceInput('down',event,code);
 if(!active||session.endedAt||['recordViewer','nicknameDialog','communityDialog'].some(id=>$('#'+id).open))return;
 if(event.ctrlKey||event.altKey||event.metaKey){pause();return;}
 if(code==='Escape'||code==='Tab'){pause();return;}
 // No editable input is used. Physical codes are counted even if the IME reports Process/229.
 const char=character(code,event.shiftKey||pressed.has('ShiftLeft')||pressed.has('ShiftRight'));
 if(!char){if(['Backspace','Enter'].includes(code))event.preventDefault();return;}
 event.preventDefault();if(event.repeat||already)return;
 const correct=isCorrect(target(),code,pressed,event.shiftKey);
 inputTrace.push(`판정 / result: target=${target().code} required=${target().shift||'none'} actual=${code} left=${pressed.has('ShiftLeft')} right=${pressed.has('ShiftRight')} profile=${shiftProfile} correct=${correct}`);if(inputTrace.length>8)inputTrace.shift();$('#inputTrace').textContent=inputTrace.join('\n');
 const firstInput=!session.startedAt;record(session,target(),char,correct);if(!correct)beep();save();renderResults();if(firstInput)syncCloud().catch(()=>{});
},true);
document.addEventListener('keyup',event=>{if(calibrateInput('up',event))return;const code=physicalCode(event,shiftProfile);pressed.delete(code);caps.get(code)?.classList.remove('pressed');traceInput('up',event,code);},true);
window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
$('#start').onclick=()=>{if(session.endedAt||currentUser&&!currentProfile)return;initSound();active=true;renderStatus();$('#start').blur();};
$('#pause').onclick=pause;$('#setSelect').onchange=e=>{select(sets[Number(e.target.value)-1].keys[0].id);$('#setSelect').blur();};
$('#calibrateShift').onclick=beginCalibration;
$('#applyKnownShift').onclick=()=>{pause();finishCalibration('ShiftUnknown');};
$('#cancelCalibration').onclick=cancelCalibration;$('#shiftCalibration').oncancel=cancelCalibration;
document.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>{pause();lang=b.dataset.lang;try{localStorage.setItem('hangul-key.language',lang);}catch{}render();});
$('#trackSelect').replaceChildren(...tracks.map((track,i)=>new Option(track.name,i)));$('#audio').src=tracks[0].src;
$('#trackSelect').onchange=()=>{const a=$('#audio'),playing=!a.paused;a.src=tracks[Number($('#trackSelect').value)].src;$('#audioError').textContent='';if(playing)a.play().catch(()=>$('#audioError').textContent=t('audioError'));};
$('#audio').onerror=()=>$('#audioError').textContent=t('audioError');
function download(){const blob=new Blob(['\ufeff',exportText(session)],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename(session);document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function openRecords(){
 if(!session.startedAt)return;
 pause();$('#recordText').textContent=exportText(session);$('#recordViewer').showModal();$('#recordText').scrollTop=0;
}
$('#finish').onclick=()=>{if(!session.startedAt)return;download();openRecords();};
$('#dismissRecords').onclick=()=>$('#recordViewer').close();$('#downloadRecords').onclick=download;
$('#restart').onclick=async()=>{
 if(authBusy||cloudVisit?.closed||!confirm(t('restartConfirm')))return;
 pause();try{await syncCloud();}catch{return;}
 session=newSession();if(cloudVisit)session.cloudVisitId=cloudVisit.id;
 if(storageBlocked){storageKey+=':recovered';storageBlocked=false;storageIssue='';}
 save();render();
};
function renderAuth(){
 const logged=Boolean(currentUser),fileLogin=authProblem?.code==='app/http-required';
 $('#authGate').hidden=logged;$('#practiceMain').hidden=false;
 $('#sessionInfo').hidden=false;$('#userEmail').hidden=!logged;$('#userEmail').textContent=currentProfile?studentLabel(currentProfile):currentUser?t('profileLoading'):'';
 $('#userEmail').disabled=!currentProfile||authBusy;
 $('#login').hidden=logged;$('#logout').hidden=!logged;$('#restart').hidden=false;$('#finish').hidden=false;$('#admin').hidden=!(currentUser?.uid===adminUid);$('#cloudNotice').textContent=t(logged?'loggedNotice':'guestNotice');$('#cloudStatus').textContent=cloudProblem?t('cloudFailed'):currentProfile?t('cloudReady'):logged?t('profileLoading'):'';
 $('#login').disabled=authBusy||(!authReady&&!fileLogin);$('#loginGate').disabled=authBusy||(!authReady&&!fileLogin);$('#logout').disabled=authBusy;
 $('#login').textContent=t(fileLogin?'webLogin':'login');$('#loginGate').textContent=t(fileLogin?'webLogin':'googleLogin');
 $('#authStatus').textContent=authBusy?t('authWorking'):!authReady?t(authProblem?'authSetupNeeded':'authLoading'):t('loginHelp');
 $('#authError').hidden=!authProblem;$('#authError').textContent=authProblem?authErrorMessage(authProblem):'';
}
function authErrorMessage(error){
 const keys={'app/http-required':'authHttp','app/config-missing':'authConfig','app/not-ready':'authConfig','auth/unauthorized-domain':'authDomain','auth/operation-not-allowed':'authProvider','auth/popup-blocked':'authPopup','auth/network-request-failed':'authNetwork'};
 return t(keys[error.code]||'authFailed')+(error.code?' ('+error.code+')':'');
}
function finalizeSession(){if(currentUser&&session.startedAt&&!session.endedAt){session.endedAt=new Date().toISOString();save();}}
function applyUser(user){
 if(currentUser?.uid===user?.uid&&Boolean(currentUser)===Boolean(user)){authReady=true;renderAuth();return;}
 finalizeSession();pause();$('#audio').pause();
 for(const id of ['recordViewer','shiftCalibration','nicknameDialog','communityDialog'])if($('#'+id).open)$('#'+id).close();
 calibration=null;currentProfile=null;cloudVisit=null;userGeneration++;inputTrace.length=0;$('#inputTrace').textContent='';
 currentUser=user;storageKey=user?'hangul-key.session.v1:user:'+user.uid:'hangul-key.guest.v1';session=newSession();storageBlocked=false;storageIssue='';
 try{const raw=localStorage.getItem(storageKey);if(raw)session=restore(raw);}catch{storageBlocked=true;storageIssue='corrupt';}session.runId ||= newSession().runId;
 authReady=true;authBusy=false;authProblem=null;render();if(user)prepareCloud(user,userGeneration).catch(cloudError);
}
const googleAuth=createGoogleAuth(firebaseConfig,applyUser,error=>{authProblem=error;authBusy=false;renderAuth();});
async function login(){
 if(authProblem?.code==='app/http-required'){pause();window.location.assign('http://localhost:8765/');return;}
 if(authBusy||!authReady)return;authBusy=true;authProblem=null;renderAuth();
 try{await googleAuth.login();}catch(error){if(error.code!=='auth/popup-closed-by-user'&&error.code!=='auth/cancelled-popup-request')authProblem=error;}
 finally{authBusy=false;renderAuth();}
}
$('#login').onclick=login;$('#loginGate').onclick=login;
$('#logout').onclick=async()=>{
 if(!currentUser||authBusy)return;pause();$('#audio').pause();authBusy=true;authProblem=null;renderAuth();
 try{await syncCloud(true);await googleAuth.logout();}catch(error){authProblem=error;}
 finally{authBusy=false;renderAuth();}
};
function cloudError(error){cloudProblem=error;$('#cloudStatus').textContent=t('cloudFailed')+(error.code?' ('+error.code+')':'');renderAuth();}
async function prepareCloud(user,generation){
 const profile=await practiceCloud.profile(user);if(currentUser?.uid!==user.uid||generation!==userGeneration)return;
 if(!profile&&user.uid!==adminUid){pause();$('#nicknameInput').value='';$('#nicknameError').textContent='';$('#nicknameDialog').showModal();return;}
 currentProfile=profile||await practiceCloud.register(user,'관리자');
 if(currentUser?.uid!==user.uid||generation!==userGeneration)return;
 await attachVisit(user,generation);renderAuth();
}
async function attachVisit(user,generation){
 let resume=null;try{resume=sessionStorage.getItem('hangul-key.visit:'+user.uid);}catch{}
 const visit=await practiceCloud.startVisit(user,currentProfile,resume);
 if(currentUser?.uid!==user.uid||generation!==userGeneration)return;
 cloudVisit=visit;cloudProblem=null;
 try{sessionStorage.setItem('hangul-key.visit:'+user.uid,visit.id);}catch{}
 // Do not copy guest, legacy, or previous-login inputs into a new cloud visit.
 if(session.startedAt&&session.cloudVisitId!==visit.id){
  try{localStorage.setItem(storageKey+':archive:'+session.runId,JSON.stringify(session));}catch{}
  session=newSession();
 }
 session.cloudVisitId=visit.id;save();render();
}
async function syncCloud(close=false){
 if(!currentUser||!currentProfile||!cloudVisit||session.cloudVisitId!==cloudVisit.id)return;
 const user=currentUser,visit=cloudVisit,snapshot=JSON.parse(JSON.stringify(session));
 if(close&&snapshot.startedAt)snapshot.endedAt ||= new Date().toISOString();
 $('#cloudStatus').textContent=t('cloudSaving');
 try{
  await practiceCloud.checkpoint(user,visit.id,snapshot,close);
  if(close){visit.closed=true;try{sessionStorage.removeItem('hangul-key.visit:'+user.uid);}catch{}if(snapshot.startedAt){session.endedAt=snapshot.endedAt;save();}}
  cloudProblem=null;if(currentUser?.uid===user.uid){renderStatus();renderAuth();}
 }catch(error){cloudError(error);throw error;}
}
$('#nicknameSave').onclick=async()=>{
 if(!currentUser)return;const user=currentUser,generation=userGeneration;$('#nicknameSave').disabled=true;$('#nicknameError').textContent='';
 try{const profile=await practiceCloud.register(user,$('#nicknameInput').value);if(userGeneration!==generation)return;currentProfile=profile;await attachVisit(user,generation);$('#nicknameDialog').close();}
 catch(error){$('#nicknameError').textContent=error.message==='nickname-invalid'?t('nicknameInvalid'):t('cloudFailed');}
 finally{$('#nicknameSave').disabled=false;}
};
$('#nicknameDialog').oncancel=event=>event.preventDefault();
$('#nicknameGuest').onclick=()=>$('#logout').onclick();
function durationLabel(ms){const seconds=Math.floor(ms/1000);return `${Math.floor(seconds/3600)}h ${Math.floor(seconds%3600/60)}m ${seconds%60}s`;}
function cloudTime(value){const ms=timestampMs(value);return ms?new Date(ms).toLocaleString(lang==='my'?'my-MM':lang==='vi'?'vi-VN':'ko-KR'):'—';}
function communityTable(headings,rowsData){
 const table=document.createElement('table'),head=document.createElement('tr');for(const name of headings){const th=document.createElement('th');th.textContent=name;head.append(th);}table.append(head);
 for(const data of rowsData){const row=document.createElement('tr');for(const value of data){const cell=document.createElement('td');if(value&&typeof value==='object')cell.append(value);else cell.textContent=String(value);row.append(cell);}table.append(row);}return table;
}
async function showStudent(uid,label){
 $('#communityTitle').textContent=label;$('#communityBody').textContent=t('cloudLoading');
 try{const visits=await practiceCloud.visitsFor(uid);const totals=studentTotals(visits,[],uid===adminUid?'':adminUid)[0];
  const summary=document.createElement('p');summary.textContent=t('studentSummary',{n:visits.length,time:durationLabel(totals?.totalMs||0),score:totals?.score||0});
  const table=communityTable([t('loginTime'),t('firstInput'),t('logoutTime'),t('practiceTime'),t('inputTotal'),t('errorTotal'),t('score')],visits.sort((a,b)=>timestampMs(b.loginAt)-timestampMs(a.loginAt)).map(v=>[cloudTime(v.loginAt),cloudTime(v.firstInputAt),cloudTime(v.logoutAt),durationLabel(visitDuration(v)),v.totalInputs,v.totalErrors,v.score]));
  $('#communityBody').replaceChildren(summary,table);
 }catch{ $('#communityBody').textContent=t('cloudFailed');}
}
function studentButton(p){const b=document.createElement('button');b.textContent=studentLabel(p);b.onclick=()=>showStudent(p.uid,studentLabel(p));return b;}
async function showCommunity(admin=false){
 pause();$('#communityTitle').textContent=t(admin?'admin':'ranking');$('#communityBody').textContent=t('cloudLoading');$('#communityDialog').showModal();
 if(!currentUser){$('#communityBody').textContent=t('rankingLogin');return;}
 if(admin&&currentUser.uid!==adminUid){$('#communityBody').textContent=t('adminDenied');return;}
 try{
  await syncCloud();let profiles=[],visits;
  if(admin){const data=await practiceCloud.adminData();profiles=data.profiles;visits=data.visits;}else visits=await practiceCloud.rankingVisits();
  let totals=studentTotals(visits,profiles,adminUid);if(!admin)totals=totals.filter(p=>p.inputs>0).slice(0,5);
  if(!totals.length){$('#communityBody').textContent=t('rankingEmpty');}
  else $('#communityBody').replaceChildren(communityTable([t('rank'),t('nickname'),t('visitCount'),t('practiceTime'),t('score')],totals.map((p,i)=>[i+1,studentButton(p),p.visits,durationLabel(p.totalMs),p.score])));
  if(admin){const note=document.createElement('p');note.textContent=t('adminExcluded');$('#communityBody').append(note);if(currentProfile){const own=document.createElement('button');own.textContent=t('adminTest');own.onclick=()=>showStudent(adminUid,studentLabel(currentProfile));$('#communityBody').append(own);}}
 }catch{ $('#communityBody').textContent=t('cloudFailed');}
}
$('#ranking').onclick=()=>showCommunity(false);$('#admin').onclick=()=>showCommunity(true);$('#communityClose').onclick=()=>$('#communityDialog').close();
$('#userEmail').onclick=async()=>{
 if(!currentUser||!currentProfile||authBusy)return;
 pause();$('#communityTitle').textContent=studentLabel(currentProfile);$('#communityBody').textContent=t('cloudLoading');$('#communityDialog').showModal();
 try{await syncCloud();await showStudent(currentUser.uid,studentLabel(currentProfile));}catch{$('#communityBody').textContent=t('cloudFailed');}
};
setInterval(()=>{if(currentUser&&currentProfile&&cloudVisit&&!cloudVisit.closed)syncCloud().catch(()=>{});},30000);
document.addEventListener('visibilitychange',()=>{if(document.hidden)syncCloud().catch(()=>{});});
render();$('#loadWarning').hidden=true;googleAuth.init();
