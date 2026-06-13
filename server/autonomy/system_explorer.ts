import os from "os";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { readDB, writeDB } from "../../db_layer";
import { detectProfession, saveProfessionProfile } from "./professions";

export interface SystemSnapshot {
  id: string;
  timestamp: string;
  type: "first_boot" | "daily_scan";
  hardware: HardwareProfile;
  software: SoftwareProfile;
  filesystem: FilesystemOverview;
  network: NetworkProfile;
  changeSummary?: string;
}

export interface HardwareProfile {
  platform: string;
  arch: string;
  hostname: string;
  cpus: { model: string; cores: number; threads: number };
  totalMemoryGB: number;
  gpus: string[];
  disks: { name: string; totalGB: number; freeGB: number; fsType: string }[];
}

export interface SoftwareProfile {
  osVersion: string;
  installedApps: string[];
  startupPrograms: string[];
  nodeVersion?: string;
  pythonVersion?: string;
  runningServices: string[];
}

export interface FilesystemOverview {
  homeDir: string;
  desktopFiles: number;
  documentsFiles: number;
  downloadsFiles: number;
  totalUserFiles: number;
  largeDirs: { path: string; sizeMB: number }[];
}

export interface NetworkProfile {
  hostname: string;
  interfaces: string[];
  ipAddresses: string[];
}

function exec(cmd: string): string {
  try { return execSync(cmd, { encoding: "utf8", timeout: 15000, windowsHide: true }).trim(); }
  catch { return ""; }
}

function getInstalledApps(): string[] {
  const apps: string[] = [];
  const out = exec(`powershell -NoProfile -Command "Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*, HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*, HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* 2>$null | Where-Object { $_.DisplayName } | Select-Object -ExpandProperty DisplayName -First 200"`);
  if (out) {
    for (const line of out.split("\n")) {
      const t = line.trim();
      if (t) apps.push(t);
    }
  }
  return apps;
}

function getStartupPrograms(): string[] {
  const out = exec(`powershell -NoProfile -Command "Get-CimInstance Win32_StartupCommand 2>$null | Select-Object -ExpandProperty Name"`);
  return out ? out.split("\n").map(l => l.trim()).filter(Boolean) : [];
}

function getRunningServices(): string[] {
  const out = exec(`powershell -NoProfile -Command "Get-Service 2>$null | Where-Object { $_.Status -eq 'Running' } | Select-Object -ExpandProperty DisplayName -First 100"`);
  return out ? out.split("\n").map(l => l.trim()).filter(Boolean) : [];
}

function getGPUInfo(): string[] {
  const gpus: string[] = [];
  const wmic = exec("wmic path win32_videocontroller get name 2>nul");
  if (wmic) {
    for (const line of wmic.split("\n")) {
      const t = line.trim();
      if (t && t !== "Name") gpus.push(t);
    }
  }
  return gpus;
}

function getDiskInfo(): SystemSnapshot["hardware"]["disks"] {
  const disks: SystemSnapshot["hardware"]["disks"] = [];
  const out = exec(`powershell -NoProfile -Command "Get-PSDrive -PSProvider FileSystem 2>$null | Where-Object { $_.Used -gt 0 } | Select-Object Name, @{N='TotalGB';E={[math]::Round($_.Used/1GB+$_.Free/1GB,1)}}, @{N='FreeGB';E={[math]::Round($_.Free/1GB,1)}} | ConvertTo-Json"`);
  try {
    const parsed = JSON.parse(out);
    for (const d of (Array.isArray(parsed) ? parsed : [parsed])) {
      disks.push({ name: d.Name, totalGB: d.TotalGB || 0, freeGB: d.FreeGB || 0, fsType: "NTFS" });
    }
  } catch {}
  return disks;
}

function getNetworkInfo(): NetworkProfile {
  const interfaces = os.networkInterfaces();
  const names: string[] = [];
  const ips: string[] = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (addrs) {
      names.push(name);
      for (const a of addrs) {
        if (a.family === "IPv4" && !a.internal) ips.push(a.address);
      }
    }
  }
  return { hostname: os.hostname(), interfaces: names, ipAddresses: ips };
}

function scanUserDirectories(): FilesystemOverview {
  const home = os.homedir();
  const desktop = path.join(home, "Desktop");
  const docs = path.join(home, "Documents");
  const downloads = path.join(home, "Downloads");

  function countFiles(dir: string): number {
    try {
      let n = 0;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isFile() || e.isDirectory()) n++;
      }
      return n;
    } catch { return 0; }
  }

  function getDirSizeMB(dir: string): number {
    try {
      let total = 0;
      const stack = [dir];
      let depth = 0;
      while (stack.length > 0 && depth < 3) {
        const current = stack.pop()!;
        let entries: fs.Dirent[] = [];
        try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch {}
        for (const e of entries) {
          const fp = path.join(current, e.name);
          if (e.isFile()) {
            try { total += fs.statSync(fp).size; } catch {}
          } else if (e.isDirectory()) {
            stack.push(fp);
          }
        }
        depth++;
      }
      return Math.round(total / (1024 * 1024));
    } catch { return 0; }
  }

  const largeDirs: { path: string; sizeMB: number }[] = [];
  for (const dir of [home, desktop, docs, downloads]) {
    const size = getDirSizeMB(dir);
    if (size > 100) largeDirs.push({ path: dir, sizeMB: size });
  }

  return {
    homeDir: home,
    desktopFiles: countFiles(desktop),
    documentsFiles: countFiles(docs),
    downloadsFiles: countFiles(downloads),
    totalUserFiles: countFiles(home),
    largeDirs,
  };
}

function scanHardwareProfile(): HardwareProfile {
  const cpus = os.cpus();
  const cpuModel = cpus[0]?.model || "Unknown";
  return {
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    cpus: { model: cpuModel, cores: cpus.length, threads: cpus.length },
    totalMemoryGB: Math.round((os.totalmem() / (1024 * 1024 * 1024)) * 10) / 10,
    gpus: getGPUInfo(),
    disks: getDiskInfo(),
  };
}

function scanSoftwareProfile(): SoftwareProfile {
  return {
    osVersion: `${os.type()} ${os.release()}`,
    installedApps: getInstalledApps(),
    startupPrograms: getStartupPrograms(),
    nodeVersion: exec("node --version") || undefined,
    pythonVersion: exec("python --version 2>&1") || exec("python3 --version 2>&1") || undefined,
    runningServices: getRunningServices(),
  };
}

export function runFirstBootExploration(): SystemSnapshot {
  console.log("[Explorer] First-boot exploration starting...");

  const snapshot: SystemSnapshot = {
    id: `explore_${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: "first_boot",
    hardware: scanHardwareProfile(),
    software: scanSoftwareProfile(),
    filesystem: scanUserDirectories(),
    network: getNetworkInfo(),
    changeSummary: `Initial exploration complete. ${os.hostname()} — ${os.cpus()[0]?.model || "Unknown CPU"} — ${Math.round(os.totalmem() / (1024 ** 3))}GB RAM`,
  };

  // Profession detection — what does this user do?
  let professionSummary = '';
  try {
    const profiles = detectProfession(snapshot.software.installedApps);
    if (profiles.length > 0) {
      saveProfessionProfile(profiles);
      professionSummary = ` | Professions: ${profiles.map(p => `${p.profession}(${Math.round(p.confidence * 100)}%)`).join(', ')}`;
      console.log(`[Explorer] Detected professions:`, profiles.map(p => `${p.profession} (${Math.round(p.confidence * 100)}%)`).join(', '));
    }
  } catch (err) { console.warn('[Explorer] Profession detection failed:', (err as Error).message); }

  // Persist
  const db = readDB();
  if (!(db as any).systemSnapshots) (db as any).systemSnapshots = [];
  (db as any).systemSnapshots.push(snapshot);

  // Mark exploration complete
  if (!(db as any).systemFlags) (db as any).systemFlags = {};
  (db as any).systemFlags.firstBootExplored = true;
  (db as any).systemFlags.lastDailyScan = snapshot.timestamp;

  writeDB(db);

  console.log(`[Explorer] First-boot complete. Host: ${snapshot.hardware.hostname}, Apps: ${snapshot.software.installedApps.length}, Disks: ${snapshot.hardware.disks.length}${professionSummary}`);
  return snapshot;
}

export function runDailyScan(): SystemSnapshot | null {
  console.log("[Explorer] Daily scan starting...");

  const db = readDB();
  const lastSnapshot = ((db as any).systemSnapshots || [])
    .filter((s: SystemSnapshot) => s.type === "daily_scan")
    .sort((a: SystemSnapshot, b: SystemSnapshot) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

  const snapshot: SystemSnapshot = {
    id: `scan_${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: "daily_scan",
    hardware: scanHardwareProfile(),
    software: scanSoftwareProfile(),
    filesystem: scanUserDirectories(),
    network: getNetworkInfo(),
  };

  // Compute changes from last scan
  if (lastSnapshot) {
    const changes: string[] = [];

    const memDelta = snapshot.hardware.totalMemoryGB - lastSnapshot.hardware.totalMemoryGB;
    if (Math.abs(memDelta) > 0.5) changes.push(`Memory ${memDelta > 0 ? '+' : ''}${memDelta.toFixed(1)}GB`);

    const newApps = snapshot.software.installedApps.filter(a => !lastSnapshot.software.installedApps.includes(a));
    const removedApps = lastSnapshot.software.installedApps.filter(a => !snapshot.software.installedApps.includes(a));
    if (newApps.length > 0) changes.push(`${newApps.length} new app(s): ${newApps.slice(0, 5).join(", ")}`);
    if (removedApps.length > 0) changes.push(`${removedApps.length} removed app(s): ${removedApps.slice(0, 3).join(", ")}`);

    const diskDeltas = snapshot.hardware.disks.filter(d => {
      const prev = lastSnapshot.hardware.disks.find(p => p.name === d.name);
      return prev && Math.abs(d.freeGB - prev.freeGB) > 2;
    });
    for (const d of diskDeltas) {
      const prev = lastSnapshot.hardware.disks.find(p => p.name === d.name)!;
      const delta = d.freeGB - prev.freeGB;
      changes.push(`${d.name}: disk free ${delta > 0 ? '+' : ''}${delta.toFixed(1)}GB (${d.freeGB.toFixed(1)}GB free)`);
    }

    if (snapshot.filesystem.totalUserFiles !== lastSnapshot.filesystem.totalUserFiles) {
      const delta = snapshot.filesystem.totalUserFiles - lastSnapshot.filesystem.totalUserFiles;
      changes.push(`User files ${delta > 0 ? '+' : ''}${delta} (total: ${snapshot.filesystem.totalUserFiles})`);
    }

    snapshot.changeSummary = changes.length > 0 ? changes.join(" | ") : "No significant changes since last scan";
  } else {
    snapshot.changeSummary = "First daily scan — baseline established";
  }

  // Persist
  if (!(db as any).systemSnapshots) (db as any).systemSnapshots = [];
  (db as any).systemSnapshots.push(snapshot);

  // Keep max 90 daily snapshots
  const dailyScans = (db as any).systemSnapshots.filter((s: SystemSnapshot) => s.type === "daily_scan");
  if (dailyScans.length > 90) {
    const oldest = dailyScans.sort((a: SystemSnapshot, b: SystemSnapshot) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];
    (db as any).systemSnapshots = (db as any).systemSnapshots.filter((s: SystemSnapshot) => s.id !== oldest.id);
  }

  if (!(db as any).systemFlags) (db as any).systemFlags = {};
  (db as any).systemFlags.lastDailyScan = snapshot.timestamp;

  writeDB(db);

  console.log(`[Explorer] Daily scan complete. ${snapshot.changeSummary}`);
  return snapshot;
}

export function getLatestExploration(): SystemSnapshot | null {
  const db = readDB();
  const snapshots = (db as any).systemSnapshots || [];
  return snapshots.sort((a: SystemSnapshot, b: SystemSnapshot) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] || null;
}

export function getExplorationHistory(limit = 30): SystemSnapshot[] {
  const db = readDB();
  return ((db as any).systemSnapshots || [])
    .sort((a: SystemSnapshot, b: SystemSnapshot) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export function isFirstBootComplete(): boolean {
  const db = readDB();
  return !!((db as any).systemFlags?.firstBootExplored);
}
