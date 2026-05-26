/**
 * LumiOS Watchdog Launcher
 *
 * Spawns server.ts as a child process and manages lifecycle:
 * - Exit code 42 → restart (self-upgrade)
 * - Crash (non-zero, non-42) → restart with backoff, max 3 retries
 * - 3 consecutive crash failures → git reset --hard + abort
 * - SIGINT/SIGTERM → clean shutdown (forward to child, exit 0)
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_SCRIPT = path.join(__dirname, 'src', 'index.ts');

const UPGRADE_EXIT_CODE = 42;
const MAX_CRASH_RETRIES = 3;
const CRASH_WINDOW_MS = 60_000; // 1 minute
const BACKOFF_BASE_MS = 2000;

let crashTimestamps: number[] = [];

function pruneOldCrashes() {
  const now = Date.now();
  crashTimestamps = crashTimestamps.filter(t => now - t < CRASH_WINDOW_MS);
}

function consecutiveCrashes(): number {
  pruneOldCrashes();
  return crashTimestamps.length;
}

async function rollbackToLastCommit() {
  console.log('[Launcher] ROLLBACK: git reset --hard HEAD...');
  return new Promise<void>((resolve) => {
    const git = spawn('git', ['reset', '--hard', 'HEAD'], {
      cwd: __dirname,
      stdio: 'inherit',
    });
    git.on('exit', (code) => {
      if (code !== 0) {
        console.error('[Launcher] ROLLBACK FAILED — manual intervention needed');
      } else {
        console.log('[Launcher] Rollback complete — reverted to last commit');
      }
      resolve();
    });
  });
}

function isTypescriptError(stderr: string): boolean {
  // If the crash is a TS compilation error, don't count it as a "crash" —
  // it means the upgrade wrote bad code. Rollback immediately.
  return /TS\d{4,5}|Cannot find module|Unexpected token|SyntaxError|TypeError/.test(stderr);
}

function restartServer(): ChildProcess {
  console.log(`[Launcher] Starting server: tsx ${path.basename(SERVER_SCRIPT)}`);

  const child = spawn('npx', ['tsx', SERVER_SCRIPT], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true,
  });

  child.on('exit', async (code, signal) => {
    console.log(`[Launcher] Server exited — code=${code}, signal=${signal}`);

    if (signal === 'SIGINT' || signal === 'SIGTERM') {
      console.log('[Launcher] Clean shutdown. Goodbye.');
      process.exit(0);
    }

    if (code === UPGRADE_EXIT_CODE) {
      console.log('[Launcher] Upgrade restart — launching new version...');
      crashTimestamps = []; // reset crash counter on successful upgrade
      setTimeout(() => restartServer(), 500);
      return;
    }

    // Crash or unexpected exit
    crashTimestamps.push(Date.now());
    const crashes = consecutiveCrashes();

    if (crashes >= MAX_CRASH_RETRIES) {
      console.error(`[Launcher] ${MAX_CRASH_RETRIES} crashes in ${CRASH_WINDOW_MS / 1000}s. Rolling back...`);
      await rollbackToLastCommit();
      crashTimestamps = [];
      setTimeout(() => restartServer(), 1000);
      return;
    }

    const delay = BACKOFF_BASE_MS * Math.pow(2, crashes - 1);
    console.log(`[Launcher] Crash ${crashes}/${MAX_CRASH_RETRIES} — restarting in ${delay / 1000}s...`);
    setTimeout(() => restartServer(), delay);
  });

  return child;
}

// Forward signals to child
let currentChild = restartServer();

process.on('SIGINT', () => {
  console.log('[Launcher] SIGINT — forwarding to server...');
  if (currentChild && !currentChild.killed) {
    currentChild.kill('SIGINT');
  }
});

process.on('SIGTERM', () => {
  console.log('[Launcher] SIGTERM — forwarding to server...');
  if (currentChild && !currentChild.killed) {
    currentChild.kill('SIGTERM');
  }
});
