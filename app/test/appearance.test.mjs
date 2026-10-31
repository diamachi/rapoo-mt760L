import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syncNativeAppearance} from '../public/appearance.mjs';
test('appearance bridge sends the selected theme to either native host',()=>{
  const mac=[],windows=[];
  syncNativeAppearance('dark',{webkit:{messageHandlers:{appearance:{postMessage:value=>mac.push(value)}}}});
  syncNativeAppearance('light',{chrome:{webview:{postMessage:value=>windows.push(value)}}});
  assert.deepEqual(mac,[{type:'appearance',theme:'dark'}]);assert.deepEqual(windows,[{type:'appearance',theme:'light'}]);
});
test('appearance changes work in a browser or unavailable native host and reject unknown themes',()=>{
  assert.doesNotThrow(()=>syncNativeAppearance('dark',{}));
  assert.doesNotThrow(()=>syncNativeAppearance('light',{webkit:{messageHandlers:{appearance:{postMessage:()=>{throw Error('closed')}}}}}));
  let calls=0;syncNativeAppearance('unexpected',{chrome:{webview:{postMessage:()=>calls++}}});assert.equal(calls,0);
});
