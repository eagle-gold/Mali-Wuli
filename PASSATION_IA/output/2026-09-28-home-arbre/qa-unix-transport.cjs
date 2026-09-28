// Transport réservé aux smokes : Hostinger refuse les connexions TCP loopback.
// Ne jamais charger ce fichier dans l’application active.
const net = require('node:net');
const http = require('node:http');
const fs = require('node:fs');
const socketPath = process.env.MW_QA_SOCKET;
if (!socketPath?.startsWith('/tmp/mali-wuli-home-qa-')) throw new Error('QA socket path required');
const listen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  const port = typeof args[0] === 'object' ? args[0]?.port : args[0];
  if ([31543,31544].includes(Number(port))) {
    const callback = args.findLast(value => typeof value === 'function');
    return callback ? listen.call(this, socketPath, callback) : listen.call(this, socketPath);
  }
  return listen.apply(this,args);
};
const realFetch = global.fetch;
global.fetch = async function(input, options = {}) {
  const url = new URL(typeof input === 'string' ? input : input.url || String(input));
  if (url.hostname !== '127.0.0.1' || !['31543','31544'].includes(url.port)) return realFetch(input,options);
  if (options.method && options.method !== 'GET') throw new Error('Read-only QA transport');
  return new Promise((resolve,reject) => {
    const request = http.request({socketPath,path:url.pathname+url.search,method:'GET',headers:{host:url.host},signal:options.signal}, response => {
      const chunks=[];
      response.on('data', chunk=>chunks.push(chunk));
      response.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:response.statusCode,headers:response.headers})));
      response.on('error',reject);
    });
    request.on('error',reject); request.end();
  });
};
// Le parent retire uniquement son socket dédié, après arrêt du serveur enfant.
if (process.argv[1]?.includes('verify-')) process.on('exit',()=>{
  try { if (fs.lstatSync(socketPath).isSocket()) fs.unlinkSync(socketPath); } catch {}
});
