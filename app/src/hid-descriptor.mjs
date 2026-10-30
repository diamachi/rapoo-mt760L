// Minimal HID short-item parser: report lengths and top-level collection usages.
// Ignores value semantics; never interprets input data as keyboard/mouse events.
export function parseHidDescriptor(bytes) {
  let state = { usagePage: 0, reportId: 0, size: 0, count: 0 }, usage = 0;
  const globals = [], stack = [], collections = [];
  for (let offset = 0; offset < bytes.length;) {
    const prefix = bytes[offset++];
    if (prefix === 0xfe) { const length = bytes[offset]; offset += 2 + length; if (offset > bytes.length) throw Error('Truncated long HID item'); continue; }
    const length = [0, 1, 2, 4][prefix & 3], type = (prefix >> 2) & 3, tag = prefix >> 4;
    if (offset + length > bytes.length) throw Error('Truncated HID item');
    let value = 0; for (let i = 0; i < length; i++) value += bytes[offset++] * 2 ** (8 * i);
    if (type === 1) {
      if (tag === 0) state.usagePage = value;
      if (tag === 7) state.size = value;
      if (tag === 8) state.reportId = value;
      if (tag === 9) state.count = value;
      if (tag === 10) globals.push({ ...state });
      if (tag === 11) { if (!globals.length) throw Error('Invalid HID global stack'); state = globals.pop(); }
    }
    if (type === 2 && tag === 0) usage = value;
    if (type !== 0) continue;
    if (tag === 10) {
      const c = { usagePage: state.usagePage, usage, inputReports: [], outputReports: [], featureReports: [] };
      if (!stack.length) collections.push(c);
      stack.push(stack[0] || c);
    } else if (tag === 12) { if (!stack.length) throw Error('Invalid HID collection stack'); stack.pop(); }
    else if ([8, 9, 11].includes(tag) && stack.length) {
      const reports = stack[0][{ 8: 'inputReports', 9: 'outputReports', 11: 'featureReports' }[tag]];
      let report = reports.find(r => r.reportId === state.reportId);
      if (!report) { report = { reportId: state.reportId, bits: 0 }; reports.push(report); }
      report.bits += state.size * state.count;
    }
    usage = 0;
  }
  if (stack.length) throw Error('Unclosed HID collection');
  return collections;
}
export function hasConfigurationReport(collections) {
  return collections.some(c => c.usagePage >= 0xff00 && c.outputReports.some(r => r.reportId === 0xba && r.bits === 248));
}
