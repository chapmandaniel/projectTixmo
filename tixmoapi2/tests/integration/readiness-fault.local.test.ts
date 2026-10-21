// Real mounted app and dependency clients. Only external providers/logger are inert.
jest.unmock('../../src/config/redis');
jest.unmock('rate-limit-redis');
jest.mock('stripe', () => jest.fn(() => ({ paymentIntents: { create: jest.fn(), retrieve: jest.fn() }, refunds: { create: jest.fn(), list: jest.fn() } })));
jest.mock('../../src/utils/notificationService', () => ({ notificationService: {} }));
import request from 'supertest';
import { Server } from 'http';
import { readFileSync, realpathSync, writeFileSync } from 'fs';
import prisma from '../../src/config/prisma';
import { connectRedis, disconnectRedis, getRedisClient } from '../../src/config/redis';
let server: Server;
const pause = (ms:number) => new Promise(resolve => setTimeout(resolve,ms));
const redisPid = Number(process.env.TASK298_REDIS_PID);
function ownedRedis() {
  expect(Number.isInteger(redisPid) && redisPid > 1).toBe(true);
  expect(realpathSync(`/proc/${redisPid}/exe`)).toBe(realpathSync(process.env.TASK298_REDIS_EXE!));
  expect(readFileSync(`/proc/${redisPid}/cmdline`,'utf8')).toContain('127.0.0.1:');
}
afterAll(async () => {
  ownedRedis(); process.kill(redisPid,'SIGCONT');
  if(server) await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await disconnectRedis(); await prisma.$disconnect();
  console.log('TASK298_API_CLOSED', process.pid);
});
test('owned Redis stall gives bounded redacted readiness503, health200, then recovery200',async()=>{
  await connectRedis();
  expect(getRedisClient().options?.database).toBe(1);
  const info = await getRedisClient().info('server');
  expect(info).toContain(`process_id:${redisPid}\r\n`);
  ownedRedis();
  const app=require('../../src/app').default;
  server=await new Promise<Server>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const apiPort=(server.address() as any).port;
  writeFileSync(`${process.env.TMPDIR}/api-owner`,`${process.pid} ${apiPort} ${readFileSync(`/proc/${process.pid}/stat`,'utf8').split(' ')[21]}\n`);
  console.log('TASK298_API_LISTENER',process.pid,server.address());
  const get=async(path:string,label:string)=>{
    const start=Date.now();const r=await request(server).get(path).timeout({response:3500,deadline:4000});
    const elapsedMs=Date.now()-start;
    console.log('TASK298_HTTP',JSON.stringify({label,path,status:r.status,elapsedMs,cacheControl:r.headers['cache-control'],body:r.body}));
    expect(elapsedMs).toBeLessThan(3500);
    if(path==='/ready'){
      expect(Object.keys(r.body).sort()).toEqual(['checks','status','timestamp']);
      expect(Object.keys(r.body.checks).sort()).toEqual(['database','redis']);
      expect(r.headers['cache-control']).toBe('no-store');
      expect(JSON.stringify(r.body)).not.toMatch(/stack|postgresql|redis:\/\/|SECRET|password|Error|\/home\//i);
    }
    return r;
  };
  const healthy=await get('/ready','healthy');expect(healthy.status).toBe(200);expect(healthy.body.checks).toEqual({database:true,redis:true});
  await pause(1100); // Expire the intentional 1-second healthy cache before fault.
  ownedRedis();process.kill(redisPid,'SIGSTOP');
  try {
    const results=await Promise.all([get('/ready','redis-stalled-1'),get('/ready','redis-stalled-2'),get('/health','liveness-during-stall')]);
    for(const r of results.slice(0,2)){expect(r.status).toBe(503);expect(r.body.status).toBe('not_ready');expect(r.body.checks.database).toBe(true);expect(r.body.checks.redis).toBeNull();}
    expect(results[2].status).toBe(200);expect(results[2].body.status).toBe('ok');
  } finally {ownedRedis();process.kill(redisPid,'SIGCONT');}
  await pause(1200);
  const restored=await get('/ready','redis-resumed');expect(restored.status).toBe(200);expect(restored.body.checks).toEqual({database:true,redis:true});
  console.log('TASK298_ASSERTIONS PASS: actual stalled Redis ping remains pending, shared probe deadline returns null/503; resumed ping resolves; no dependency replacement');
},20000);
