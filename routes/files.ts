/**
 * Real filesystem API — browses the user's actual home directory.
 *
 * File IDs are relative paths from HOME. All operations are sandboxed within HOME.
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { readDB, writeDB } from '../db_layer';
import { ingestDocument } from '../server/agents/rag';

const HOME = os.homedir();
const router = Router();

// ── Auth middleware ──
const JWT_SECRET = process.env.JWT_SECRET || 'lumi_secret_key_2026';

function requireAuth(req: Request, res: Response, next: () => void): void {
  let token = req.cookies.token;
  // Fallback to Authorization header (for Tauri WebView2)
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7);
  }
  if (!token) {
    res.status(401).json({ error: 'Login required' });
    return;
  }
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Temp upload staging
const uploadDir = path.join(os.tmpdir(), 'lumi-uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

// ── Helpers ──

/** Resolve a relative path (file ID) to an absolute path within HOME. */
function resolvePath(relativePath: string): string {
  // Normalize: strip leading slashes, resolve ..
  const clean = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const resolved = path.resolve(HOME, clean);
  if (!resolved.startsWith(HOME + path.sep) && resolved !== HOME) {
    throw new Error('Path escapes home directory');
  }
  return resolved;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ── GET /files/list — list directory contents ──
router.get('/files/list', (req: Request, res: Response) => {
  try {
    const subPath = (req.query.path as string) || '';
    const targetDir = resolvePath(subPath);

    if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
      return res.json({ files: [], path: subPath, home: HOME });
    }

    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue; // skip hidden
      try {
        const fullPath = path.join(targetDir, entry.name);
        const st = fs.statSync(fullPath);
        const relativePath = path.relative(HOME, fullPath).replace(/\\/g, '/');
        files.push({
          id: relativePath,
          name: entry.name,
          type: entry.isDirectory() ? 'folder' as const : 'file' as const,
          size: entry.isDirectory() ? '--' : formatSize(st.size),
          rawSize: st.size,
          status: 'local' as const,
          updatedAt: st.mtime.toISOString(),
        });
      } catch {
        // skip inaccessible entries
      }
    }

    files.sort((a: any, b: any) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    // Limit to 500 entries for performance
    res.json({ files: files.slice(0, 500), path: subPath, home: HOME });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /files/upload — upload files into a directory ──
router.post('/files/upload', requireAuth, upload.array('files', 20), (req: Request, res: Response) => {
  try {
    const subPath = (req.query.path as string) || '';
    const destDir = resolvePath(subPath);

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const uploadedFiles = req.files as Express.Multer.File[];
    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const saved: string[] = [];
    for (const file of uploadedFiles) {
      let dest = path.join(destDir, file.originalname);
      // Avoid overwriting
      let counter = 1;
      const ext = path.extname(file.originalname);
      const base = path.basename(file.originalname, ext);
      while (fs.existsSync(dest)) {
        dest = path.join(destDir, `${base} (${counter})${ext}`);
        counter++;
      }
      fs.renameSync(file.path, dest);
      saved.push(path.relative(HOME, dest).replace(/\\/g, '/'));
    }

    res.json({ uploaded: saved.map(id => ({ id, name: path.basename(id) })), count: saved.length });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET /files/download/:id — download a file ──
router.get('/files/download/:id', (req: Request, res: Response) => {
  try {
    const absPath = resolvePath(req.params.id);
    if (!fs.existsSync(absPath) || fs.statSync(absPath).isDirectory()) {
      return res.status(404).json({ error: 'File not found' });
    }
    const name = path.basename(absPath);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
    fs.createReadStream(absPath).pipe(res);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ── DELETE /files/delete/:id — delete a file or folder ──
router.delete('/files/delete/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const absPath = resolvePath(req.params.id);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (fs.statSync(absPath).isDirectory()) {
      fs.rmSync(absPath, { recursive: true });
    } else {
      fs.unlinkSync(absPath);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /files/rename — rename a file or folder ──
router.post('/files/rename', requireAuth, (req: Request, res: Response) => {
  try {
    const { id, newName } = req.body;
    if (!id || !newName) return res.status(400).json({ error: 'id and newName are required' });

    const absPath = resolvePath(id);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const dir = path.dirname(absPath);
    const dest = path.join(dir, newName);
    if (fs.existsSync(dest)) {
      return res.status(409).json({ error: 'A file with that name already exists' });
    }

    fs.renameSync(absPath, dest);
    const newId = path.relative(HOME, dest).replace(/\\/g, '/');
    res.json({ success: true, id: newId, name: newName });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET /files/info/:id — file metadata ──
router.get('/files/info/:id', (req: Request, res: Response) => {
  try {
    const absPath = resolvePath(req.params.id);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const st = fs.statSync(absPath);
    res.json({
      id: req.params.id,
      name: path.basename(absPath),
      size: st.size,
      formattedSize: formatSize(st.size),
      type: st.isDirectory() ? 'folder' : 'file',
      updatedAt: st.mtime.toISOString(),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /files/ingest — chunk a file into agent memory (RAG) ──
router.post('/files/ingest', async (req: Request, res: Response) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const JWT_SECRET = process.env.JWT_SECRET || 'lumi_secret_key_2026';
    let userId: string;
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      userId = decoded.uid;
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { fileId, agentId } = req.body;
    if (!fileId || !agentId) {
      return res.status(400).json({ error: 'fileId and agentId are required' });
    }

    const absPath = resolvePath(fileId);
    if (!fs.existsSync(absPath) || fs.statSync(absPath).isDirectory()) {
      return res.status(404).json({ error: 'File not found' });
    }

    const content = fs.readFileSync(absPath, 'utf-8');
    const result = await ingestDocument(userId, agentId, fileId, content);
    res.json({ success: true, chunkCount: result.chunkCount, memoryIds: result.memoryIds });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /files/disk — disk usage info ──
router.get('/files/disk', (_req: Request, res: Response) => {
  try {
    let total = 0, free = 0;
    try {
      const st = fs.statfsSync(HOME);
      total = (st as any).bsize * (st as any).blocks || 0;
      free = (st as any).bsize * (st as any).bfree || 0;
    } catch {
      // statfs not available on all platforms
    }
    res.json({
      home: HOME,
      totalBytes: total,
      freeBytes: free,
      totalFormatted: formatSize(total),
      freeFormatted: formatSize(free),
      usedPercent: total > 0 ? Math.round(((total - free) / total) * 100) : 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
