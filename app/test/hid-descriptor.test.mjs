import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromHex } from '../src/protocol.mjs';
import { parseHidDescriptor, hasConfigurationReport } from '../src/hid-descriptor.mjs';
// Actual descriptors read from the attached 24ae:1870 receiver, 2026-10-30.
const configuration = '05010906a1018501050719e029e71500250175019508810295017508810395057501050819012905910295017503910395067508150025650507190029ff8100c005010980a101850205011981298315002501950375018106950175058101c0050c0901a1018503150026800319002a8003751095018100c00600ff090ea10185ba7508951f150026ff000901810009019100c00600ff0902a10185bb75089506150026ff000902810009029100c0';
const mouse = '05010902a1010901a1000509190129051500250175019505810275039501810105010930093116008026ff7f75109502810609381581257f750895018106050c0a380295018106c0c0';
const auxiliary = '0601ff0900a1018506150026ff0019012aff00951c750809018102090291020904b102c0';
test('finds vendor report BA inside receiver interface whose primary usage is keyboard', () => {
  const collections = parseHidDescriptor(fromHex(configuration));
  assert.equal(collections[0].usage, 6); assert.equal(hasConfigurationReport(collections), true);
  const vendor = collections.find(c => c.usagePage === 0xff00 && c.usage === 14);
  assert.deepEqual(vendor.outputReports, [{ reportId: 0xba, bits: 248 }]);
  assert.deepEqual(vendor.inputReports, [{ reportId: 0xba, bits: 248 }]);
});
test('excludes the mouse and auxiliary receiver interfaces', () => {
  assert.equal(hasConfigurationReport(parseHidDescriptor(fromHex(mouse))), false);
  assert.equal(hasConfigurationReport(parseHidDescriptor(fromHex(auxiliary))), false);
});
test('rejects truncated descriptor data', () => {
  assert.throws(() => parseHidDescriptor(fromHex('06ff')));
  assert.throws(() => parseHidDescriptor(fromHex(configuration.slice(0, -2))));
});
