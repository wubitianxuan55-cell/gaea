interface LatencyRecord {
  type: 'llm' | 'tts' | 'stt';
  ms: number;
  timestamp: number;
}

const MAX_RECORDS = 100;
const ringBuffer: LatencyRecord[] = [];

export function recordLatency(type: LatencyRecord['type'], ms: number) {
  ringBuffer.push({ type, ms, timestamp: Date.now() });
  if (ringBuffer.length > MAX_RECORDS * 3) {
    ringBuffer.splice(0, ringBuffer.length - MAX_RECORDS * 3);
  }
}

export function getLatencyStats() {
  const now = Date.now();
  const cutoff = now - 300_000; // last 5 minutes
  const recent = ringBuffer.filter(r => r.timestamp > cutoff);

  const compute = (type: string) => {
    const records = recent.filter(r => r.type === type).map(r => r.ms);
    if (records.length === 0) return { avgMs: 0, lastMs: 0, count: 0 };
    const avg = records.reduce((a, b) => a + b, 0) / records.length;
    return {
      avgMs: Math.round(avg),
      lastMs: Math.round(records[records.length - 1]),
      count: records.length,
    };
  };

  return {
    llm: compute('llm'),
    tts: compute('tts'),
    stt: compute('stt'),
  };
}
