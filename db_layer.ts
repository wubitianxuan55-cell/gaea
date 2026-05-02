import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_PATH = path.join(process.cwd(), 'data', 'lumi.db');
const DB_DIR = path.dirname(DB_PATH);

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let db: sqlite3.Database | null = null;
let memoryDB: any = null;

export async function initDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) { reject(err); return; }
      db!.run('PRAGMA foreign_keys = ON', async (err) => {
        if (err) { reject(err); return; }
        await migrateSchema();
        await createTables();
        await loadMemoryDB();
        resolve();
      });
    });
  });
}

// Add missing columns to existing tables (safe on old DB)
function migrateSchema(): Promise<void> {
  return new Promise((resolve) => {
    // Add 'phone' column to users if it doesn't exist (old DB lacks it)
    db!.run("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''", () => {});
    // Add 'status' column to agents if it doesn't exist
    db!.run("ALTER TABLE agents ADD COLUMN status TEXT DEFAULT 'active'", () => {});
    // Add 'role' column to interactions if it doesn't exist
    db!.run("ALTER TABLE interactions ADD COLUMN role TEXT DEFAULT ''", () => {});
    // Add 'personality' column to interactions if it doesn't exist
    db!.run("ALTER TABLE interactions ADD COLUMN personality TEXT DEFAULT ''", () => {});
    // Give SQLite time for ALTER TABLEs to complete
    setTimeout(resolve, 200);
  });
}

function createTables(): Promise<void> {
  return new Promise((resolve, reject) => {
    const sql = `
      CREATE TABLE IF NOT EXISTS users (
        uid TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        balance REAL DEFAULT 0,
        phone TEXT DEFAULT '',
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        config TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        userId TEXT,
        status TEXT DEFAULT 'active',
        FOREIGN KEY (userId) REFERENCES users (uid)
      );

      CREATE TABLE IF NOT EXISTS interactions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        agentId TEXT,
        module TEXT,
        message TEXT NOT NULL,
        response TEXT,
        role TEXT DEFAULT '',
        personality TEXT DEFAULT '',
        timestamp TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users (uid),
        FOREIGN KEY (agentId) REFERENCES agents (id)
      );

      CREATE TABLE IF NOT EXISTS marketplace_skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        author TEXT NOT NULL,
        price REAL NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS founder_vision (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        content TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `;

    db!.exec(sql, (err) => {
      if (err) { reject(err); return; }
      insertInitialData().then(resolve).catch(reject);
    });
  });
}

async function insertInitialData(): Promise<void> {
  const tables = ['users', 'agents', 'interactions', 'marketplace_skills', 'skills', 'founder_vision'];
  const counts: { [table: string]: number } = {};

  for (const table of tables) {
    const count = await query<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM ${table}`);
    counts[table] = count[0]?.cnt ?? 0;
  }

  if (counts.users === 0) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const now = new Date().toISOString();
    await run(
      `INSERT INTO users (uid, username, password, role, balance, phone, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['admin-uid', 'admin', hashedPassword, 'admin', 1000, '', now]
    );
  }

  if (counts.marketplace_skills === 0) {
    const defaultSkills = [
      ['skill-1', '财务报表分析 LoRA', 'LumiNode_01', 50, '针对企业财务报表的深度微调权重，支持自动化对账与异常检测。', 'Finance'],
      ['skill-2', '创意剧本创作 LoRA', 'CreativeMind', 30, '专注于科幻与悬疑风格的剧本创作，具备极强的逻辑连贯性。', 'Creative'],
      ['skill-3', '医疗辅助诊断 LoRA', 'HealthGuard', 100, '基于公开医疗数据集微调，辅助识别常见病症与用药建议。', 'Medical']
    ];
    for (const skill of defaultSkills) {
      await run(`INSERT INTO marketplace_skills (id, name, author, price, description, category) VALUES (?, ?, ?, ?, ?, ?)`, skill);
    }
  }

  if (counts.skills === 0) {
    const coreSkills = [
      ['vision', 'Vision Core', 'Advanced image recognition and spatial awareness.'],
      ['logic', 'Logic Engine', 'Complex reasoning and mathematical problem solving.'],
      ['empathy', 'Empathy Module', 'Emotional intelligence and nuanced conversation.']
    ];
    for (const skill of coreSkills) {
      await run(`INSERT INTO skills (id, name, description) VALUES (?, ?, ?)`, skill);
    }
  }

  if (counts.founder_vision === 0) {
    await run(
      `INSERT INTO founder_vision (id, content, updatedAt) VALUES (?, ?, ?)`,
      [1, 'LumiAI 旨在构建一个去中心化的智能协议。我们追求空间存在感、边缘计算与数据主权。通过分布式节点，每一个用户都能拥有真正属于自己的、可进化的数字生命。', new Date().toISOString()]
    );
  }
}

// Load database and map old column names to field names server.ts expects
async function loadMemoryDB(): Promise<void> {
  const users = await query<any>('SELECT * FROM users');
  const agentsRaw = await query<any>('SELECT * FROM agents');
  const interactionsRaw = await query<any>('SELECT * FROM interactions');
  const marketplaceSkills = await query<any>('SELECT * FROM marketplace_skills');
  const skills = await query<any>('SELECT * FROM skills');
  const founderVisionRow = await query<any>('SELECT content FROM founder_vision WHERE id = 1');
  const founderVision = founderVisionRow[0]?.content || '';

  // Map old column names to the field names that server.ts expects
  const agents = agentsRaw.map((a: any) => ({
    ...a,
    ownerUid: a.userId || a.ownerUid,
    data: a.config || a.data || '{}',
  }));

  const interactions = interactionsRaw.map((i: any) => ({
    ...i,
    content: i.message || i.content || '',
    role: i.role || '',
    personality: i.personality || i.module || '',
  }));

  memoryDB = {
    users,
    agents,
    interactions,
    marketplaceSkills,
    skills,
    founderVision,
    chatHistories: {}
  };
}

function run(sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db!.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db!.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

export function readDB(): any {
  if (!memoryDB) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return memoryDB;
}

export function writeDB(data: any): void {
  if (!db) {
    throw new Error('Database not initialized.');
  }
  memoryDB = data;
  persistMemoryDB().catch(err => {
    console.error('Failed to persist database:', err);
  });
}

async function persistMemoryDB(): Promise<void> {
  const tables = ['interactions', 'agents', 'users', 'marketplace_skills', 'skills', 'founder_vision'];

  await run('BEGIN TRANSACTION');
  try {
    for (const table of tables) {
      await run(`DELETE FROM ${table}`);
    }

    for (const user of memoryDB.users) {
      await run(
        `INSERT INTO users (uid, username, password, role, balance, phone, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [user.uid, user.username, user.password, user.role, user.balance, user.phone || '', user.createdAt]
      );
    }

    for (const agent of memoryDB.agents) {
      await run(
        `INSERT INTO agents (id, name, category, config, createdAt, userId, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          agent.id, agent.name, agent.category,
          agent.data || agent.config || '{}',
          agent.createdAt,
          agent.ownerUid || agent.userId || null,
          agent.status || 'active'
        ]
      );
    }

    for (const interaction of memoryDB.interactions) {
      await run(
        `INSERT INTO interactions (id, userId, agentId, module, message, response, role, personality, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          interaction.id,
          interaction.userId || 'unknown',
          interaction.agentId || null,
          interaction.personality || interaction.module || null,
          interaction.content || interaction.message || '',
          interaction.response || '',
          interaction.role || '',
          interaction.personality || '',
          interaction.timestamp
        ]
      );
    }

    for (const skill of memoryDB.marketplaceSkills) {
      await run(
        `INSERT INTO marketplace_skills (id, name, author, price, description, category) VALUES (?, ?, ?, ?, ?, ?)`,
        [skill.id, skill.name, skill.author, skill.price, skill.description, skill.category]
      );
    }

    for (const skill of memoryDB.skills) {
      await run(
        `INSERT INTO skills (id, name, description) VALUES (?, ?, ?)`,
        [skill.id, skill.name, skill.description]
      );
    }

    if (memoryDB.founderVision) {
      await run(
        `INSERT OR REPLACE INTO founder_vision (id, content, updatedAt) VALUES (?, ?, ?)`,
        [1, memoryDB.founderVision, new Date().toISOString()]
      );
    }

    await run('COMMIT');
  } catch (err) {
    await run('ROLLBACK');
    throw err;
  }
}

let initStarted = false;
export function ensureDatabaseInitialized(): Promise<void> {
  if (!initStarted) {
    initStarted = true;
    return initDatabase();
  }
  return Promise.resolve();
}

export async function querySQL<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return query<T>(sql, params);
}

export async function runSQL(sql: string, params: any[] = []): Promise<void> {
  return run(sql, params);
}
