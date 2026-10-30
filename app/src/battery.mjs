// BaseDevice/MT760 getElectricity: status, BatStatus, Electricity (percentage).
// Live MT760L reply: 01 01 4c => 76%. No voltage/lifetime conversion.
export function decodeBatteryReport(report) {
  if (!(report instanceof Uint8Array) || ![3,32].includes(report.length) || report[0]!==1 || report[2]>100 || report.slice(3).some(byte=>byte!==0)) {
    throw Error('Mouse did not return a valid battery percentage');
  }
  return { percent:report[2], batteryStatus:report[1], source:'mouse-reported' };
}
