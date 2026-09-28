'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const home='/home/u668963025',domain=home+'/domains/mali-wuli.com',builds=domain+'/hbuilds';
const result={at:new Date().toISOString(),files:[],directives:[],processes:[],remoteWrites:0};
for(const p of [domain,domain+'/public_html',domain+'/nodejs',builds+'/current',builds+'/current/nodejs',builds+'/current/nodejs/tmp/restart.txt',builds+'/versions/20260928-home-session-r2/nodejs/tmp/restart.txt',domain+'/public_html/.htaccess',domain+'/.htaccess',builds+'/.htaccess']){
 try{const s=fs.lstatSync(p);result.files.push({path:p,kind:s.isSymbolicLink()?'symlink':s.isDirectory()?'directory':'file',target:s.isSymbolicLink()?fs.readlinkSync(p):undefined,realpath:fs.realpathSync(p),mtime:s.mtime.toISOString(),mode:(s.mode&0o777).toString(8)});if(p.endsWith('.htaccess'))result.directives.push({path:p,lines:fs.readFileSync(p,'utf8').split('\n').filter(x=>/^\s*(?:Passenger(?:AppRoot|AppType|StartupFile|Nodejs|RestartDir|Enabled|AppEnv)|#.*passenger)/i.test(x))});}catch(e){result.files.push({path:p,error:e.code});}
}
for(const p of ['/usr/bin/passenger-config','/usr/local/bin/passenger-config','/opt/passenger/bin/passenger-config'])if(fs.existsSync(p))result.passengerConfig=p;
// Process metadata only. Do not inspect environment or arbitrary command lines.
for(const pid of fs.readdirSync('/proc').filter(p=>/^\d+$/.test(p))){try{const uid=fs.statSync('/proc/'+pid).uid;if(uid!==process.getuid())continue;const cwd=fs.readlinkSync('/proc/'+pid+'/cwd');if(!cwd.startsWith(domain))continue;const comm=fs.readFileSync('/proc/'+pid+'/comm','utf8').trim();result.processes.push({pid,comm,cwd,exe:fs.readlinkSync('/proc/'+pid+'/exe')});}catch{}}
console.log(JSON.stringify(result,null,2));
