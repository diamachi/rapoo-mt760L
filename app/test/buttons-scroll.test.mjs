import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BUTTONS,encodeButton,allowedParameterWrite,actionsForButton} from '../src/buttons.mjs';
import {addressOf,toHex,fromHex} from '../src/protocol.mjs';
import {lineDelta,validateLines} from '../src/scroll.mjs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
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
test('raw wheel counts preserve every notch and direction, skip continuous and zero values',()=>{
  assert.equal(lineDelta(1,false,3),3);assert.equal(lineDelta(20,false,3),60);assert.equal(lineDelta(-12,false,7),-84);
  assert.equal(lineDelta(1,true,3),null);assert.equal(lineDelta(0,false,3),null);
  for(const n of [0,101,-1,NaN,1.5])assert.throws(()=>validateLines(n));
});
test('native macOS scroll field conversion works without posting events or creating a tap',{skip:process.platform!=='darwin'},()=>{
  const output=execFileSync(process.execPath,['--experimental-ffi',fileURLToPath(new URL('../native/macos-scroll.mjs',import.meta.url)),'--self-test'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  assert.deepEqual(JSON.parse(output),{nativeScrollFieldTest:'passed',eventsPosted:0,eventTapCreated:false});
  const bindings=execFileSync(process.execPath,['--experimental-ffi',fileURLToPath(new URL('../native/macos-scroll.mjs',import.meta.url)),'--check-bindings'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  assert.deepEqual(JSON.parse(bindings),{nativeScrollBindings:'passed',eventsPosted:0,eventTapCreated:false});
});
