import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';

const dbPath = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'reliability.db');

// Ensure the directory for the database file exists if it is in a subdirectory
const dbDir = path.dirname(dbPath);
import fs from 'fs';
if (!fs.existsSync(dbDir)) {
	fs.mkdirSync(dbDir, { recursive: true });
}

export const sqlite = new Database(dbPath);
// Enable WAL mode for better performance on concurrent reads/writes
sqlite.pragma('journal_mode = WAL');

export const db = drizzle(sqlite, { schema });
export type DbType = typeof db;
export { schema };
