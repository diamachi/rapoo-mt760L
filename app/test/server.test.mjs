import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createAppServer } from '../server.mjs';
test('battery reads require an authorized connected receiver, decode real reply and cache briefly',async()=>{
  let reads=0;
  const native=async op=>op==='list'?{devices:[{id:'123',compatible:true}]}:op==='battery'?(reads++,{batteryReport:'01014c'}):{device:{id:'123'}};
  const server=createAppServer({native,platform:'darwin'});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}`;
  try {
    const status=await(await fetch(url+'/api/native/status')).json();
    const post=(route,body={},token=status.token)=>fetch(url+'/api/native/'+route,{method:'POST',headers:{Origin:url,'X-Rapoo-Token':token},body:JSON.stringify(body)});
    assert.equal((await post('battery',{id:'123'},'bad')).status,403);
    assert.equal((await post('battery',{id:'123'})).status,400);assert.equal(reads,0);
    await post('connect',{id:'123'});
    const result=await(await post('battery',{id:'123'})).json();assert.equal(result.percent,76);assert.equal(result.source,'mouse-reported');assert.ok(result.updatedAt);
    assert.equal((await(await post('battery',{id:'123'})).json()).percent,76);assert.equal(reads,1);
    assert.equal((await post('battery',{id:'456'})).status,400);
    await post('disconnect');assert.equal((await post('battery',{id:'123'})).status,400);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
test('read-only rate measurement requires session authorization, excludes concurrent writes and reports development mode',async()=>{
  let finish, started;
  const measuring=new Promise(resolve=>started=resolve);
  const native=async op=>op==='list'?{devices:[{id:'123',compatible:true}]}:{device:{id:'123'}};
  const measure=()=>{started();return new Promise(resolve=>finish=resolve);};
  const server=createAppServer({native,measure,platform:'darwin',development:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await(await fetch(url+'/api/info')).json()).development,true);
    const status=await(await fetch(url+'/api/native/status')).json();assert.equal(status.measurementAvailable,true);
    const post=(route,body={},token=status.token)=>fetch(url+'/api/native/'+route,{method:'POST',headers:{Origin:url,'X-Rapoo-Token':token},body:JSON.stringify(body)});
    assert.equal((await post('measure-rate',{},'bad')).status,403);
    assert.equal((await fetch(url+'/api/native/measure-rate')).status,405);
    await post('connect',{id:'123'});
    const pending=post('measure-rate');await measuring;
    assert.equal((await post('measure-rate')).status,409);
    const blocked=await post('send',{id:'123',hex:'baa5a504300600000404ffff0000000000000000000000000000000000000000'});
    assert.equal(blocked.status,400);assert.match((await blocked.json()).error,/measurement/);
    finish({sufficient:false,reportsSent:0});assert.equal((await(await pending).json()).reportsSent,0);
  } finally {if(finish)finish({});await new Promise(resolve=>server.close(resolve));}
});
test('serves local app and capture; rejects unexpected hosts, mutations and unlisted files', async () => {
  const server = createAppServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const home = await fetch(url); assert.equal(home.status, 200); assert.match(await home.text(), /MT760L/);
    assert.match(home.headers.get('content-security-policy'), /default-src 'self'/);
    const capture = await fetch(url + '/api/capture'); assert.equal((await capture.json()).length, 107);
    assert.equal((await fetch(url+'/api/native/scroll-status')).status,404);
    assert.equal((await fetch(url+'/api/native/scroll-start',{method:'POST'})).status,404);
    assert.equal((await fetch(url+'/assets/mt760l.webp')).headers.get('content-type'),'image/webp');
    assert.equal((await fetch(url + '/api/capture', { method: 'POST' })).status, 405);
    assert.equal((await fetch(url + '/package.json')).status, 404);
    const badHost = await new Promise((resolve, reject) => { const r = request(url, { headers: { Host: 'evil.example:8760' } }, res => { res.resume(); resolve(res.statusCode); }); r.on('error', reject); r.end(); });
    assert.equal(badHost, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('Windows native desktop path uses the same protected receiver API and polling reports',async()=>{
  const calls=[],device={id:'123',compatible:true};
  const native=async(operation,...args)=>{calls.push([operation,...args]);return operation==='list'?{devices:[device]}:{device,status:operation==='send'?'sent-unverified':'opened'};};
  const server=createAppServer({platform:'win32',native});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}`;
  try {
    const status=await(await fetch(url+'/api/native/status')).json();assert.equal(status.platform,'win32');assert.equal(status.available,true);
    const post=(op,body)=>fetch(url+'/api/native/'+op,{method:'POST',headers:{Origin:url,'X-Rapoo-Token':status.token},body:JSON.stringify(body)});
    await post('connect',{id:'123'});
    assert.equal((await post('send',{id:'123',hex:'baa5a504300600000404ffff0000000000000000000000000000000000000000'})).status,200);
    assert.equal(calls.at(-1)[0],'send');
    assert.equal((await post('send',{id:'123',hex:'baa5a504300600000804ffff0000000000000000000000000000000000000000'})).status,400);
  } finally {await new Promise(resolve=>server.close(resolve));}
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
