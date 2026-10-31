import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BUTTONS,encodeButton,allowedParameterWrite,actionsForButton} from '../src/buttons.mjs';
import {addressOf,toHex,fromHex} from '../src/protocol.mjs';
import {encodePolling, validPolling} from '../src/polling.mjs';
import {readFileSync} from 'node:fs';
test('polling rates reproduce the captured 1000, 250 and 125 Hz reports exactly',()=>{
  const fixture=JSON.parse(readFileSync(new URL('../data/protocol-fixture.json',import.meta.url)));
  for(const [frame,hz] of [[40,1000],[44,250],[48,125],[52,1000],[56,125]]) {
    const packet=fromHex(fixture.find(p=>p.frame===frame).payload);
    assert.deepEqual(encodePolling(hz,packet),packet);
    assert.equal(allowedParameterWrite(packet),true);
  }
  assert.deepEqual(Array.from(encodePolling(500).slice(8,12)),[2,2,255,255]);
});
test('polling validation rejects unsupported rates, unequal modes, damaged tails and wrong addresses',()=>{
  for(const hz of [0,2000,8000,NaN,126])assert.throws(()=>encodePolling(hz));
  for(const [offset,value] of [[9,4],[10,0],[12,1],[4,0]]) {
    const packet=encodePolling(125);packet[offset]=value;assert.equal(validPolling(packet),false);assert.equal(allowedParameterWrite(packet),false);
  }
});
test('all 11 vendor-profile input IDs address distinct four-byte records',()=>{
  assert.equal(BUTTONS.length,11);
  for(const button of BUTTONS){const b=encodeButton(button.id,button.defaultAction);assert.equal(addressOf(b),0x600+4*button.id);assert.equal(b[3],4);assert.equal(allowedParameterWrite(b),true);}
  assert.equal(BUTTONS[1].name,'Middle / wheel click');
  assert.equal(BUTTONS[4].name,'DPI button');
});
test('DPI button cycle action exactly reproduces capture frame 106',()=>{
  assert.equal(toHex(encodeButton(4,'dpi-cycle')).replace(/ /g,''),'baa5a50410060000080003000000000000000000000000000000000000000000');
});
test('mouse bitmasks, keyboard modifiers, media byte order and disabled input follow DLL stores',()=>{
  const body=b=>Array.from(b.slice(8,12));
  assert.deepEqual(body(encodeButton(6,'back')),[3,0,8,0]);
  assert.deepEqual(body(encodeButton(0,'double-click')),[3,0,1,1]);
  assert.deepEqual(body(encodeButton(3,'shortcut',{key:6,modifiers:8})),[2,0,8,6]);
  assert.deepEqual(body(encodeButton(3,'shortcut',{key:82,modifiers:0})),[1,0,82,0]);
  assert.deepEqual(body(encodeButton(3,'volume-up')),[4,0,0,0xe9]);
  assert.deepEqual(body(encodeButton(3,'disabled')),[7,0,0,0]);
  assert.deepEqual(body(encodeButton(7,'scroll-left')),[12,0,1,255]);
  assert.deepEqual(body(encodeButton(8,'scroll-right')),[12,0,2,255]);
});
test('rejects unsupported actions, invalid targets/shortcuts and malformed button reports',()=>{
  assert.throws(()=>encodeButton(11,'left'));assert.throws(()=>encodeButton(0,'unknown'));
  assert.throws(()=>encodeButton(9,'dpi-cycle'));assert.throws(()=>encodeButton(0,'scroll-up'));
  assert.throws(()=>encodeButton(3,'shortcut',{key:999,modifiers:8}));
  assert.throws(()=>encodeButton(3,'shortcut',{key:6,modifiers:16}));
  const b=encodeButton(3,'left');b[8]=255;assert.equal(allowedParameterWrite(b),false);
  const c=encodeButton(3,'left');c[12]=1;assert.equal(allowedParameterWrite(c),false);
  for(const b of BUTTONS)for(const a of actionsForButton(b.id))assert.equal(allowedParameterWrite(encodeButton(b.id,a.id)),true);
});

test('changing a primary click requires consent; restoring its standard action and other inputs do not',async()=>{
  const {requiresPrimaryClickConsent}=await import('../src/buttons.mjs');
  assert.equal(requiresPrimaryClickConsent(encodeButton(0,'left')),false);
  assert.equal(requiresPrimaryClickConsent(encodeButton(2,'right')),false);
  for(const [id,action] of [[0,'disabled'],[0,'right'],[2,'left'],[2,'shortcut']])assert.equal(requiresPrimaryClickConsent(encodeButton(id,action)),true);
  assert.equal(requiresPrimaryClickConsent(encodeButton(5,'disabled')),false);
});
