import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleAuth} from '../auth.js';
const config={apiKey:'web-test-key',authDomain:'example.firebaseapp.com',projectId:'example',appId:'test-app'};
function sdkMock(){
 const calls=[],listeners={};let popupError=null,signOutError=null;
 const sdk={
  initializeApp:c=>(calls.push(['config',c]),{}),getAuth:()=>({}),browserSessionPersistence:'session',
  setPersistence:async(a,p)=>calls.push(['persistence',p]),
  GoogleAuthProvider:class{setCustomParameters(p){calls.push(['provider',p]);}},
  onAuthStateChanged:(a,cb,error)=>{listeners.user=cb;listeners.error=error;},
  signInWithPopup:async()=>{calls.push(['popup']);if(popupError)throw popupError;},
  signOut:async()=>{calls.push(['signout']);if(signOutError)throw signOutError;listeners.user(null);}
 };
 return {sdk,calls,listeners,failPopup:e=>popupError=e,failSignOut:e=>signOutError=e};
}
test('Google Auth uses Google provider, account picker and session persistence',async()=>{
 const m=sdkMock(),users=[],errors=[];
 const service=createGoogleAuth(config,u=>users.push(u),e=>errors.push(e),async()=>m.sdk,'http:');
 await service.init();const user={uid:'one',email:'one@gmail.com',providerData:[{providerId:'google.com'}]};m.listeners.user(user);
 await service.login();await service.logout();
 assert.deepEqual(m.calls.map(c=>c[0]),['config','persistence','provider','popup','signout']);
 assert.equal(m.calls[1][1],'session');assert.equal(m.calls[2][1].prompt,'select_account');assert.deepEqual(users,[user,null]);assert.deepEqual(errors,[]);
});
test('file URL and missing web config fail closed without loading SDK',async()=>{
 for(const [c,protocol,code] of [[config,'file:','app/http-required'],[{},'http:','app/config-missing']]){
  let loaded=false;const users=[],errors=[];const s=createGoogleAuth(c,u=>users.push(u),e=>errors.push(e),async()=>{loaded=true;},protocol);
  await s.init();assert.equal(loaded,false);assert.equal(errors[0].code,code);assert.deepEqual(users,[]);await assert.rejects(s.login(),{code:'app/not-ready'});
 }
});
test('password/anonymous accounts cannot unlock Google-only practice',async()=>{
 const m=sdkMock(),users=[];const service=createGoogleAuth(config,u=>users.push(u),()=>{},async()=>m.sdk,'https:');await service.init();
 m.listeners.user({uid:'password-user',providerData:[{providerId:'password'}]});await Promise.resolve();
 assert.ok(users.every(u=>u===null));assert.ok(m.calls.some(c=>c[0]==='signout'));
});
test('popup and logout failures are returned to caller; observer errors are reported',async()=>{
 const m=sdkMock(),errors=[];const service=createGoogleAuth(config,()=>{},e=>errors.push(e),async()=>m.sdk,'https:');await service.init();
 const error=Object.assign(Error('offline'),{code:'auth/network-request-failed'});m.failPopup(error);m.failSignOut(error);
 await assert.rejects(service.login(),error);await assert.rejects(service.logout(),error);m.listeners.error(error);assert.deepEqual(errors,[error]);
});
test('SDK load failure is reported without allowing login',async()=>{
 const errors=[];const service=createGoogleAuth(config,()=>{},e=>errors.push(e),async()=>{throw Error('SDK unavailable');},'https:');
 await service.init();assert.equal(errors[0].message,'SDK unavailable');await assert.rejects(service.login(),{code:'app/not-ready'});
});
