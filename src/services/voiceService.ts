const BASE = '/api/voice';

export async function uploadSamples(files: File[]): Promise<{ urls: string[]; filenames: string[]; count: number }> {
  const form = new FormData();
  files.forEach(f => form.append('samples', f));

  const res = await fetch(`${BASE}/samples`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Upload failed');
  }
  return res.json();
}

export async function cloneVoice(sampleUrls: string[], name: string, provider?: string): Promise<{ voiceId: string; name: string; provider: string }> {
  const res = await fetch(`${BASE}/clone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sampleUrls, name, provider }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Clone failed' }));
    throw new Error(err.error || 'Clone failed');
  }
  return res.json();
}

export async function listVoices(): Promise<{ cloned: any[]; premade: any[] }> {
  const res = await fetch(`${BASE}/voices`);
  if (!res.ok) throw new Error('Failed to fetch voices');
  return res.json();
}

export async function deleteVoice(voiceId: string): Promise<void> {
  const res = await fetch(`${BASE}/${voiceId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete voice');
}

export async function synthesizeSpeech(text: string, voiceId: string, provider?: string): Promise<ArrayBuffer> {
  const res = await fetch(`${BASE}/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId, provider }),
  });
  if (!res.ok) throw new Error('Speech synthesis failed');
  return res.arrayBuffer();
}
