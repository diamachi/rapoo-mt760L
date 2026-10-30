// Observed moving-report timing, not firmware readback or USB bus polling.
export function summarizeRate(sample) {
  const values = sample.intervalsMs.filter(ms => Number.isFinite(ms) && ms >= 0.25 && ms <= 50).sort((a,b)=>a-b);
  const dropped = sample.intervalsMs.length - values.length;
  if (values.length < 100) return { source: sample.source, sufficient: false, movementReports: sample.movementReports, intervals: values.length, excludedIntervals: dropped, reportsSent: 0 };
  const median = values.length % 2 ? values[(values.length-1)/2] : (values[values.length/2-1]+values[values.length/2])/2;
  return { source: sample.source, sufficient: true, movementReports: sample.movementReports, intervals: values.length,
    medianMs: median, medianHz: 1000/median, meanHz: 1000*values.length/values.reduce((n,ms)=>n+ms,0),
    p10Ms: values[Math.floor((values.length-1)*0.1)], p90Ms: values[Math.floor((values.length-1)*0.9)],
    excludedIntervals: dropped, durationSeconds: sample.durationSeconds, reportsSent: 0 };
}
