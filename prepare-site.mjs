// Publish an explicit allowlist, never the entire repository or local workspace.
import {copyFile,mkdir,readdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export const siteFiles=['index.html','styles.css','app.bundle.js','keyboard-check.html',
 ...[1,2,3,4].map(n=>`music/track${n}.mp3`)];
const output=new URL('./dist/',import.meta.url);
await mkdir(new URL('music/',output),{recursive:true});
for(const file of siteFiles)await copyFile(new URL(file,import.meta.url),new URL(file,output));
await writeFile(new URL('.nojekyll',output),'');
const expected=new Set([...siteFiles,'.nojekyll']);
async function audit(folder,prefix=''){
 for(const entry of await readdir(folder,{withFileTypes:true})){
  const path=prefix+entry.name;
  if(entry.isDirectory()&&path==='music')await audit(new URL('music/',folder),'music/');
  else if(!entry.isFile()||!expected.delete(path))throw Error(`Unexpected public artifact: ${path}`);
 }
}
await audit(output);
if(expected.size)throw Error('Missing public artifacts: '+[...expected].join(', '));
console.log(`Public site ready: ${fileURLToPath(output)} (${siteFiles.length+1} approved files)`);
