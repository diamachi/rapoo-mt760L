import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { linuxReceivers } from '../native/linux-hid.mjs';

// Vendor collection from the captured USB receiver descriptor.
const config = '0600ff090ea10185ba7508951f150026ff000901810009019100c0';
const auxiliary = '0600ff0902a10185bb75089506150026ff000902810009029100c0';

test('Linux scan accepts only USB MT760L interfaces exposing the supported BA report', async t => {
  const root = await mkdtemp(join(tmpdir(), 'openrapoo-hid-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const fixtures = [
    ['hidraw0', '0003:000024AE:00001870', config],
    ['hidraw1', '0003:000024AE:00001870', auxiliary],
    ['hidraw2', '0005:000024AE:00001870', config],
    ['hidraw3', '0003:000024AE:00001871', config],
    ['hidraw4', '0003:000024AE:00001870', '06ff'],
  ];
  for (const [name, identity, descriptor] of fixtures) {
    const dir = join(root, name, 'device');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'uevent'), 'HID_ID=' + identity + '\n');
    await writeFile(join(dir, 'report_descriptor'), Buffer.from(descriptor, 'hex'));
  }
  const devices = await linuxReceivers(root);
  assert.deepEqual(devices.map(d => [d.path, d.info.compatible]), [
    ['/dev/hidraw0', true], ['/dev/hidraw1', false], ['/dev/hidraw4', false],
  ]);
  assert.equal(devices[0].info.outputReportBytes, 32);
  assert.equal(devices[0].info.reportId, 0xba);
  assert.equal(devices[0].info.path, undefined);
  assert.match(devices[0].info.id, /^\d{1,20}$/);
});
