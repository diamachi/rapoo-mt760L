import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeBatteryReport } from '../src/battery.mjs';
test('battery decodes the live MT760L reply without estimating or changing the percentage',()=>{
  assert.deepEqual(decodeBatteryReport(Uint8Array.of(1,1,0x4c)),{percent:76,batteryStatus:1,source:'mouse-reported'});
  for(const percent of [0,1,20,99,100])assert.equal(decodeBatteryReport(Uint8Array.of(1,0,percent)).percent,percent);
  const padded=new Uint8Array(32);padded.set([1,1,76]);assert.equal(decodeBatteryReport(padded).percent,76);
});
test('battery rejects timeout, invalid percentage, unexpected report and truncated replies',()=>{
  for(const report of [[2,1,76],[1,0,255],[1,1],[0xba,0xa5,0xaa],[1,1,76,0],[]])assert.throws(()=>decodeBatteryReport(Uint8Array.from(report)));
  const dirty=new Uint8Array(32);dirty.set([1,1,76]);dirty[10]=4;assert.throws(()=>decodeBatteryReport(dirty));
});
