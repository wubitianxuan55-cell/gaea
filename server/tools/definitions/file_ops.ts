import fs from 'fs';
import path from 'path';
import os from 'os';
import { ToolRegistry } from '../registry';

function resolveSafePath(userPath: string, cwd?: string): string {
  const base = cwd || process.cwd();
  const resolved = path.resolve(base, userPath);
  const normalized = path.normalize(resolved);

  const allowedRoots = [
    os.homedir(),
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    os.tmpdir(),
  ];

  const isAllowed = allowedRoots.some(root =>
    normalized.startsWith(path.normalize(root) + path.sep) ||
    normalized === path.normalize(root)
  );

  if (!isAllowed) {
    throw new Error(`Access denied: "${normalized}" is outside allowed paths.`);
  }

  return normalized;
}

function simpleGlobToRegex(pattern: string): RegExp {
  let regexStr = '';
  let i = 0;
  while (i < pattern.length) {
    if (pattern[i] === '*' && pattern[i + 1] === '*') {
      regexStr += '.*';
      i += 2;
      if (pattern[i] === '/' || pattern[i] === '\\') i++;
    } else if (pattern[i] === '*') {
      regexStr += '[^/\\\\]*';
      i++;
    } else if (pattern[i] === '?') {
      regexStr += '[^/\\\\]';
      i++;
    } else if ('.+^${}()|[]\\'.includes(pattern[i])) {
      regexStr += '\\' + pattern[i];
      i++;
    } else {
      regexStr += pattern[i];
      i++;
    }
  }
  return new RegExp('^' + regexStr + '$');
}

async function readFileHandler(args: Record<string, any>, context?: { cwd?: string }): Promise<string> {
  const targetPath = resolveSafePath(args.path || '.', context?.cwd);
  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    throw new Error(`"${targetPath}" is a directory, not a file.`);
  }
  if (stat.size > 100 * 1024) {
    throw new Error(`File too large (${(stat.size / 1024).toFixed(1)}KB). Max 100KB.`);
  }
  return fs.readFileSync(targetPath, 'utf-8');
}

async function writeFileHandler(args: Record<string, any>, context?: { cwd?: string }): Promise<string> {
  const targetPath = resolveSafePath(args.path || '.', context?.cwd);

  const blockedPaths = ['/etc', '/sys', '/proc', '/dev', 'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)'];
  const normalizedTarget = path.normalize(targetPath);
  for (const blocked of blockedPaths) {
    if (normalizedTarget.startsWith(path.normalize(blocked))) {
      throw new Error(`Access denied: cannot write to system path "${targetPath}".`);
    }
  }

  const content = String(args.content || '');
  if (content.length > 500 * 1024) {
    throw new Error(`Content too large (${(content.length / 1024).toFixed(1)}KB). Max 500KB.`);
  }

  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(targetPath, content, 'utf-8');
  return `File written: ${targetPath} (${content.length} bytes)`;
}

async function listDirectoryHandler(args: Record<string, any>, context?: { cwd?: string }): Promise<string> {
  const targetPath = resolveSafePath(args.path || '.', context?.cwd);
  const stat = fs.statSync(targetPath);
  if (!stat.isDirectory()) {
    throw new Error(`"${targetPath}" is not a directory.`);
  }

  const entries = fs.readdirSync(targetPath, { withFileTypes: true });
  const results = entries.slice(0, 500).map(entry => {
    const fullPath = path.join(targetPath, entry.name);
    let size = 0;
    try {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) {
        size = fs.statSync(fullPath).size;
      }
    } catch {
      // ignore stat errors for inaccessible files
    }
    return {
      name: entry.name,
      path: fullPath,
      isDirectory: entry.isDirectory(),
      size,
    };
  });

  return JSON.stringify(results, null, 2);
}

async function searchFilesHandler(args: Record<string, any>, context?: { cwd?: string }): Promise<string> {
  const directory = resolveSafePath(args.directory || '.', context?.cwd);
  const pattern = args.pattern || '*';
  const regex = simpleGlobToRegex(pattern);

  const results: string[] = [];
  const maxResults = 200;

  function walk(dir: string) {
    if (results.length >= maxResults) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= maxResults) return;
      const relativePath = path.relative(directory, path.join(dir, entry.name));
      if (regex.test(relativePath) || regex.test(entry.name)) {
        const fullPath = path.join(dir, entry.name);
        results.push(fullPath);
      }
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        walk(path.join(dir, entry.name));
      }
    }
  }

  walk(directory);
  return JSON.stringify(results.slice(0, maxResults), null, 2);
}

export function registerFileOpsTools(registry: ToolRegistry): void {
  registry.register({
    name: 'read_file',
    description: 'Read the contents of a file. Returns the file content as text.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute or relative path to the file to read' },
      },
      required: ['path'],
    },
    handler: readFileHandler,
    permission: 'user',
  });

  registry.register({
    name: 'write_file',
    description: 'Write content to a file. Creates parent directories if needed.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file to write' },
        content: { type: 'string', description: 'Content to write to the file' },
      },
      required: ['path', 'content'],
    },
    handler: writeFileHandler,
    permission: 'user',
  });

  registry.register({
    name: 'list_directory',
    description: 'List files and subdirectories in a directory. Returns a JSON array.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to list. Defaults to current directory.' },
      },
      required: [],
    },
    handler: listDirectoryHandler,
    permission: 'user',
  });

  registry.register({
    name: 'search_files',
    description: 'Search for files matching a glob pattern. Returns matching file paths.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Glob pattern like "**/*.ts" or "*.json"' },
        directory: { type: 'string', description: 'Directory to search in. Defaults to current directory.' },
      },
      required: ['pattern'],
    },
    handler: searchFilesHandler,
    permission: 'user',
  });
}
