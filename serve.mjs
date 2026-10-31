// Local-only static server for Firebase Auth tests. No installation needed.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.mp3':'audio/mpeg'};
const files=new Set(['index.html','styles.css','app.bundle.js','keyboard-check.html']);
const port=Number(process.argv[2]||8765);
createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';
  if(!files.has(path)&&!/^music\/[^/\\]+\.mp3$/i.test(path)){res.writeHead(404);res.end();return;}
  const content=await readFile(new URL(path,import.meta.url));
  const extension=path.slice(path.lastIndexOf('.'));
  res.writeHead(200,{'Content-Type':mime[extension]||'application/octet-stream','Content-Length':content.length,'Cache-Control':'no-store'});
  res.end(req.method==='HEAD'?undefined:content);
 }catch{res.writeHead(404);res.end();}
}).listen(port,'127.0.0.1',()=>console.log(`Open http://localhost:${port}`));
