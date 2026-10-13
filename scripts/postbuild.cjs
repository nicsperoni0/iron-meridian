const fs=require('fs');const f='dist/sw.js';fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace(/im-v3-[^']*'(\+'[^']*')?/,"im-v2-"+Date.now()+"'"));
