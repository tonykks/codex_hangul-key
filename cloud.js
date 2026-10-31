import {normalizeNickname,practiceScore,sessionCounts,resultChunks} from './cloud-model.js';
async function loadFirestore(){const [a,f]=await Promise.all([import('https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js')]);return {...a,...f};}
export function createPracticeCloud(config,adminUid,loadSDK=loadFirestore){
 let sdk,db,loading;let queue=Promise.resolve();const uploaded=new Map();
 async function init(){if(!loading)loading=loadSDK().then(s=>{sdk=s;db=s.getFirestore(s.getApps().length?s.getApp():s.initializeApp(config));});return loading;}
 const ref=(...parts)=>sdk.doc(db,...parts);
 const serial=fn=>{const next=queue.catch(()=>{}).then(fn);queue=next;return next;};
 return {
  async profile(user){await init();const snap=await sdk.getDoc(ref('students',user.uid));return snap.exists()?{uid:user.uid,...snap.data()}:null;},
  async register(user,nickname){
   await init();const data={nickname:normalizeNickname(nickname),shortId:user.uid.slice(-4),createdAt:sdk.serverTimestamp()};
   await sdk.runTransaction(db,async tx=>{const r=ref('students',user.uid),old=await tx.get(r);if(!old.exists())tx.set(r,data);});return this.profile(user);
  },
  async startVisit(user,profile,resumeId){
   await init();if(resumeId){const old=await sdk.getDoc(ref('visits',resumeId));if(old.exists()&&old.data().uid===user.uid&&!old.data().logoutAt)return {id:resumeId,...old.data()};}
   const r=sdk.doc(sdk.collection(db,'visits'));const data={uid:user.uid,nickname:profile.nickname,shortId:profile.shortId,loginAt:sdk.serverTimestamp(),firstInputAt:null,logoutAt:null,lastSeenAt:sdk.serverTimestamp(),totalInputs:0,totalErrors:0,durationMs:0,score:0};
   await sdk.setDoc(r,data);return {id:r.id,...(await sdk.getDoc(r)).data()};
  },
  checkpoint(user,visitId,session,close=false){return serial(async()=>{
   await init();const {inputs,errors}=sessionCounts(session);const runId=session.runId;
   if(!runId)throw Error('run-id-missing');
   // Bound each private result document so practice length has no 1 MiB cap.
   const chunks=resultChunks(session).filter(c=>uploaded.get(user.uid+'/'+runId+'/'+c.id)!==c.entries.length);
   for(let i=0;i<chunks.length;i+=400){const batch=sdk.writeBatch(db),part=chunks.slice(i,i+400);for(const c of part){const {id,...data}=c;batch.set(ref('students',user.uid,'runs',runId,'chunks',id),data);}await batch.commit();for(const c of part)uploaded.set(user.uid+'/'+runId+'/'+c.id,c.entries.length);}
   const vr=ref('visits',visitId),rr=ref('students',user.uid,'runs',runId);
   await sdk.runTransaction(db,async tx=>{
    const vs=await tx.get(vr),rs=await tx.get(rr);if(!vs.exists()||vs.data().uid!==user.uid)throw Error('visit-owner');
    const v=vs.data(),r=rs.exists()?rs.data():{inputs:0,errors:0};if(v.logoutAt)return;
    if(inputs<r.inputs||errors<r.errors)throw Error('run-count-regressed');
    const totalInputs=v.totalInputs+inputs-r.inputs,totalErrors=v.totalErrors+errors-r.errors;
    const first=v.firstInputAt;
    // Ranking derives time from server firstInputAt/logoutAt/lastSeenAt.
    // The numeric cache uses acknowledged server time too, never the PC clock.
    const update={totalInputs,totalErrors,score:practiceScore(totalInputs,totalErrors),lastSeenAt:sdk.serverTimestamp(),durationMs:first?Math.max(v.durationMs,v.lastSeenAt.toMillis()-first.toMillis()):0};
    if(!first&&inputs>0)update.firstInputAt=sdk.serverTimestamp();
    if(close)update.logoutAt=sdk.serverTimestamp();
    tx.set(rr,{visitId,inputs,errors,startedAt:session.startedAt,endedAt:session.endedAt||null});tx.update(vr,update);
   });
  });},
  async visitsFor(uid){await init();const snapshot=await sdk.getDocs(sdk.query(sdk.collection(db,'visits'),sdk.where('uid','==',uid)));return snapshot.docs.map(d=>({id:d.id,...d.data()}));},
  async rankingVisits(){await init();const snapshot=await sdk.getDocs(sdk.query(sdk.collection(db,'visits'),sdk.where('uid','!=',adminUid)));return snapshot.docs.map(d=>({id:d.id,...d.data()}));},
  async adminData(){await init();const [p,v]=await Promise.all([sdk.getDocs(sdk.collection(db,'students')),sdk.getDocs(sdk.collection(db,'visits'))]);return {profiles:p.docs.map(d=>({uid:d.id,...d.data()})),visits:v.docs.map(d=>({id:d.id,...d.data()}))};},
  async drain(){await queue;}
 };
}
