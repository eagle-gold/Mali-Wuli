// Garde des régressions locales : chaque opération réelle échoue avant accès réseau/base.
const refuse = (operation) => function() { throw new Error(`REAL_IO_FORBIDDEN:${operation}`); };
const net = require('node:net');
net.Socket.prototype.connect = refuse('socket.connect');
net.Server.prototype.listen = refuse('server.listen');
require('node:tls').connect = refuse('tls.connect');
for(const name of ['node:http','node:https']) { const module=require(name); module.request=refuse(name+'.request'); module.get=refuse(name+'.get'); }
globalThis.fetch=refuse('fetch');
const client=require('/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/backend/node_modules/@prisma/client');
client.PrismaClient.prototype.$connect=refuse('prisma.$connect');
client.PrismaClient.prototype._request=refuse('prisma._request');
require('/Users/ibrahimakonate/Documents/ChatGPT/MALI-WULI-hostinger-integration/backend/node_modules/nodemailer').createTransport=refuse('mail.createTransport');
