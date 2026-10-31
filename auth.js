async function loadFirebaseSDK(){
 const [appSDK,authSDK]=await Promise.all([
  import('https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js'),
  import('https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js')
 ]);
 return {...appSDK,...authSDK};
}
export function createGoogleAuth(config,onUser,onError,loadSDK=loadFirebaseSDK,protocol=globalThis.location?.protocol){
 let sdk,auth,provider,ready=false;
 function fail(code){const e=new Error(code);e.code=code;return e;}
 return {
  async init(){
   try{
    if(!['http:','https:'].includes(protocol))throw fail('app/http-required');
    if(!['apiKey','authDomain','projectId','appId'].every(k=>typeof config[k]==='string'&&config[k].trim()))throw fail('app/config-missing');
    sdk=await loadSDK();auth=sdk.getAuth(sdk.initializeApp(config));
    await sdk.setPersistence(auth,sdk.browserSessionPersistence);
    provider=new sdk.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
    ready=true;
    sdk.onAuthStateChanged(auth,user=>{
     if(user&&!user.providerData?.some(p=>p.providerId==='google.com')){
      onUser(null);sdk.signOut(auth).catch(onError);return;
     }
     onUser(user||null);
    },onError);
   }catch(error){ready=false;onError(error);}
  },
  async login(){if(!ready)throw fail('app/not-ready');return sdk.signInWithPopup(auth,provider);},
  async logout(){if(!ready)throw fail('app/not-ready');return sdk.signOut(auth);}
 };
}
