import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createAppServer } from '../server.mjs';
test('serves local app and capture; rejects unexpected hosts, mutations and unlisted files', async () => {
  const server = createAppServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const home = await fetch(url); assert.equal(home.status, 200); assert.match(await home.text(), /MT760L/);
    assert.match(home.headers.get('content-security-policy'), /default-src 'self'/);
    const capture = await fetch(url + '/api/capture'); assert.equal((await capture.json()).length, 107);
    assert.equal((await fetch(url + '/api/capture', { method: 'POST' })).status, 405);
    assert.equal((await fetch(url + '/package.json')).status, 404);
    const badHost = await new Promise((resolve, reject) => { const r = request(url, { headers: { Host: 'evil.example:8760' } }, res => { res.resume(); resolve(res.statusCode); }); r.on('error', reject); r.end(); });
    assert.equal(badHost, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('native bridge requires same-origin session token and a probed receiver before writes', async () => {
  const calls = [], device = { id: '4296065912', compatible: true, vendorId: 0x24ae, productId: 0x1870 };
  const native = async (op, ...args) => { calls.push([op, ...args]); return op === 'list' ? { devices: [device] } : { device, status: op === 'send' ? 'sent-unverified' : 'opened' }; };
  const server = createAppServer({ platform: 'darwin', native });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const status = await (await fetch(url + '/api/native/status')).json(); assert.equal(status.devices[0].id, device.id);
    const post = (route, body, headers = {}) => fetch(url + '/api/native/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: url, 'X-Rapoo-Token': status.token, ...headers }, body: JSON.stringify(body) });
    assert.equal((await post('connect', { id: device.id }, { 'X-Rapoo-Token': 'bad' })).status, 403);
    assert.equal((await post('connect', { id: device.id }, { Origin: 'https://example.com' })).status, 403);
    const hex = 'baa5a51438060000100014001800220040005000000005000300020300000000';
    assert.equal((await post('send', { id: device.id, hex })).status, 400); assert.equal(calls.some(c => c[0] === 'send'), false);
    assert.equal((await post('connect', { id: device.id })).status, 200);
    const sent = await post('send', { id: device.id, hex }); assert.equal(sent.status, 200); assert.equal((await sent.json()).status, 'sent-unverified');
    assert.equal((await post('send', { id: device.id, hex: hex.replace('38060000', '00100000') })).status, 400);
    assert.equal((await post('disconnect', {})).status, 200);
    assert.equal((await post('send', { id: device.id, hex })).status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('native access-denied errors reach the UI as actionable JSON', async () => {
  const server = createAppServer({ platform: 'darwin', native: async op => {
    if (op === 'list') return { devices: [{ id: '123', compatible: true }] };
    throw Error('Open MT760L configuration interface failed (0xe00002e2). macOS denied HID access.');
  } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const status = await (await fetch(url + '/api/native/status')).json();
    const result = await fetch(url + '/api/native/connect', { method: 'POST', headers: { Origin: url, 'X-Rapoo-Token': status.token }, body: JSON.stringify({ id: '123' }) });
    assert.equal(result.status, 400); assert.match((await result.json()).error, /macOS denied/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('scroll helper controls require authorization, validate lines, and stop on server close',async()=>{
  let running=false,lines=null;
  const scroll={status:()=>({running,lines}),start:async n=>{if(!Number.isInteger(n)||n<1||n>100)throw Error('Choose 1–100 lines');running=true;lines=n;return scroll.status();},stop:async()=>{running=false;lines=null;return scroll.status();}};
  const server=createAppServer({platform:'darwin',scroll,native:async()=>({devices:[]})});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
  try{
    const {token}=await(await fetch(url+'/api/native/status')).json();
    const post=(route,body,t=token)=>fetch(url+'/api/native/'+route,{method:'POST',headers:{Origin:url,'X-Rapoo-Token':t},body:JSON.stringify(body)});
    assert.equal((await post('scroll-start',{lines:3},'bad')).status,403);assert.equal(running,false);
    assert.equal((await post('scroll-start',{lines:0})).status,400);assert.equal(running,false);
    assert.equal((await post('scroll-start',{lines:7})).status,200);assert.equal(lines,7);
    assert.equal((await(await fetch(url+'/api/native/scroll-status')).json()).running,true);
    await post('scroll-stop',{});assert.equal(running,false);
    await post('scroll-start',{lines:3});
  }finally{await new Promise(resolve=>server.close(resolve));assert.equal(running,false);}
});
