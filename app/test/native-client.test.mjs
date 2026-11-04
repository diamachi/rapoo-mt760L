import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NativeTransport } from '../src/native-client.mjs';

test('native connection selects a compatible vendor collection among other HID collections', async () => {
  const calls = [], device = { id: '42', compatible: true };
  const transport = new NativeTransport(async (route, options) => {
    calls.push({ route, options });
    return route.endsWith('/status') ? { token: 'test', devices: [{ id: '1', compatible: false }, device] } : { device };
  }, () => {});
  assert.equal(await transport.connect(), device);
  assert.deepEqual(calls.map(c => c.route), ['/api/native/status', '/api/native/connect']);
  assert.equal(calls[1].options.body.id, '42');
});

test('failed detection distinguishes absent receiver from rejected collections without sending commands', async () => {
  for (const devices of [[], [{ id: '42', compatible: false, detectionError: 'Metadata access failed' }]]) {
    const calls = [], logs = [];
    const transport = new NativeTransport(async route => {
      calls.push(route); return { token: 'test', devices };
    }, (...entry) => logs.push(entry));
    await assert.rejects(transport.connect(), devices.length ? /Found 1.*Export device details/ : /did not expose an MT760L/);
    assert.deepEqual(calls, ['/api/native/status']);
    assert.deepEqual(JSON.parse(logs[0][1]).devices, devices);
  }
});
