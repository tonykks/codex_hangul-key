// Used both before local commits and before deployment. Do not print secrets.
import {execFileSync} from 'node:child_process';
const allowed=new Set([
 '.gitignore','.gitattributes','.githooks/pre-commit','.github/workflows/deploy.yml',
 'README.md','package.json','build.mjs','prepare-site.mjs','release-check.mjs',
 'index.html','styles.css','app.bundle.js','keyboard-check.html',
 'practice-data.js','core.js','cloud-model.js','translations.js','firebase-config.js',
 'auth.js','cloud.js','app.js','firestore.rules','serve.mjs',
 'tests/auth.test.js','tests/browser-script.test.js','tests/cloud.test.js','tests/core.test.js',
 'tests/fixtures/shift-v20261031.4.js',
 ...[1,2,3,4].map(n=>`music/track${n}.mp3`)
]);
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:4*1024*1024});
const paths=git('ls-files','--cached','-z').split('\0').filter(Boolean);
const privatePatterns=[
 /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/,
 /["']private_key["']\s*:\s*["'][^"']+/,
 /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
 /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
 /\bAKIA[A-Z0-9]{16}\b/,
 /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/
];
let failed=false;
for(const path of paths){
 if(!allowed.has(path)){console.error(`Release blocked: unapproved path ${path}`);failed=true;continue;}
 const mode=git('ls-files','--stage','--',path).split(' ')[0];
 if(!['100644','100755'].includes(mode)){console.error(`Release blocked: non-regular file ${path}`);failed=true;continue;}
 if(path.endsWith('.mp3'))continue;
 const staged=git('show',':'+path);
 if(privatePatterns.some(pattern=>pattern.test(staged))){console.error(`Release blocked: possible private credential in ${path}`);failed=true;}
}
if(failed)process.exit(1);
console.log(`Release check passed: ${paths.length} approved tracked files; no matching private credentials.`);
