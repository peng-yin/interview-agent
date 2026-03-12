import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'interviews.db');

// 使用 globalThis 缓存数据库实例，防止 Next.js 热重载时创建多个连接
const globalForDb = globalThis as unknown as { __interviewDb?: Database.Database };

function getDb(): Database.Database {
  if (!globalForDb.__interviewDb) {
    // Ensure data directory exists
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS interviews (
        id TEXT PRIMARY KEY,
        position TEXT NOT NULL DEFAULT 'frontend',
        difficulty TEXT NOT NULL DEFAULT 'mid',
        duration INTEGER NOT NULL DEFAULT 30,
        resume TEXT,
        candidate_name TEXT,
        candidate_email TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        room_name TEXT,
        report TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        started_at TEXT,
        completed_at TEXT
      );
    `);

    // Migration: add resume column if not exists
    try {
      db.exec(`ALTER TABLE interviews ADD COLUMN resume TEXT`);
    } catch {
      // Column already exists, ignore
    }

    globalForDb.__interviewDb = db;
  }
  return globalForDb.__interviewDb;
}

export interface Interview {
  id: string;
  position: string;
  difficulty: string;
  duration: number;
  resume: string | null;
  candidate_name: string | null;
  candidate_email: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'expired';
  room_name: string | null;
  report: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export function createInterview(data: {
  id: string;
  position: string;
  difficulty: string;
  duration: number;
  resume?: string;
}): Interview {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO interviews (id, position, difficulty, duration, resume)
    VALUES (@id, @position, @difficulty, @duration, @resume)
  `);
  stmt.run({ ...data, resume: data.resume || null });
  return getInterview(data.id)!;
}

export function getInterview(id: string): Interview | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM interviews WHERE id = ?');
  return (stmt.get(id) as Interview) || null;
}

export function listInterviews(): Interview[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM interviews ORDER BY created_at DESC');
  return stmt.all() as Interview[];
}

export function updateInterviewCandidate(
  id: string,
  candidateName: string,
  candidateEmail: string
): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE interviews
    SET candidate_name = ?, candidate_email = ?, status = 'in_progress', started_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(candidateName, candidateEmail, id);
}

export function updateInterviewRoom(id: string, roomName: string): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE interviews SET room_name = ? WHERE id = ?');
  stmt.run(roomName, id);
}

export function updateInterviewReport(id: string, report: string): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE interviews
    SET report = ?, status = 'completed', completed_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(report, id);
}

export function deleteInterview(id: string): void {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM interviews WHERE id = ?');
  stmt.run(id);
}
