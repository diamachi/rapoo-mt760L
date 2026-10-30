import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeRate } from '../src/rate-stats.mjs';
const sample=intervalsMs=>({intervalsMs,movementReports:intervalsMs.length+1,source:'synthetic HID timestamps',durationSeconds:6});
test('native rate summary distinguishes 125 and 1000 Hz without display timing',()=>{
  for(const hz of [125,250,500,1000]){
    const result=summarizeRate(sample(Array(500).fill(1000/hz)));
    assert.equal(result.medianHz,hz);assert.equal(result.meanHz,hz);assert.equal(result.sufficient,true);
  }
});
test('rate summary excludes pauses, invalid times and duplicate-like intervals',()=>{
  const result=summarizeRate(sample([...Array(500).fill(2),0,0.01,-1,100,NaN,Infinity]));
  assert.equal(result.medianHz,500);assert.equal(result.excludedIntervals,6);assert.equal(result.intervals,500);
});
test('stationary or sparse mouse data is not presented as a measured rate',()=>{
  const result=summarizeRate(sample([8,8]));assert.equal(result.sufficient,false);assert.equal(result.medianHz,undefined);
});
