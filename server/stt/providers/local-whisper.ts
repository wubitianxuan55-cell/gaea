// local-whisper STT provider — runs faster-whisper via Python subprocess.
// No API key needed. Model (~500MB) auto-downloads on first use.
// Falls back to cloud providers if Python or the script is unavailable.

import { execFileSync, execSync } from 'child_process';
import { STTResult } from '../types';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.join(__dirname, '..', 'local_whisper.py');

let pythonPath: string | null = null;
let checkedPython = false;

function findPython(): string | null {
  if (checkedPython) return pythonPath;
  checkedPython = true;

  const candidates = [
    path.join(process.cwd(), 'gpt-sovits-src', 'venv', 'Scripts', 'python.exe'),
    path.join(process.cwd(), '..', 'gpt-sovits-src', 'venv', 'Scripts', 'python.exe'),
    'python3', 'python',
  ];

  for (const cmd of candidates) {
    try {
      execSync(`${cmd} --version`, { stdio: 'pipe', timeout: 5000 });
      pythonPath = cmd;
      return cmd;
    } catch {}
  }
  return null;
}

export function isLocalWhisperAvailable(): boolean {
  return findPython() !== null && fs.existsSync(SCRIPT_PATH);
}

export async function transcribe(audioBuffer: Buffer, language: string = 'zh'): Promise<STTResult> {
  const python = findPython();
  if (!python) throw new Error('Python not found. Local STT requires Python 3.10+.');

  if (!fs.existsSync(SCRIPT_PATH)) {
    throw new Error(`Local whisper script not found at ${SCRIPT_PATH}`);
  }

  // Write audio to temp WAV file
  const tmpDir = os.tmpdir();
  const wavPath = path.join(tmpDir, `gaea_stt_${Date.now()}.wav`);
  fs.writeFileSync(wavPath, audioBuffer);

  try {
    const stdout = execFileSync(python, [SCRIPT_PATH, wavPath], {
      encoding: 'utf-8',
      timeout: 30000, // 30s for first run (model download), 2s for subsequent
      maxBuffer: 1024 * 1024,
      env: { ...process.env },
    });

    const text = stdout.trim();
    return { text, isFinal: true };
  } finally {
    // Clean up temp file
    try { fs.unlinkSync(wavPath); } catch {}
  }
}
