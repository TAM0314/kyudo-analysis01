import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../prisma/dev.db');
const sqlPath = path.resolve(__dirname, '../prisma/migrations/20260806155933_init/migration.sql');

console.log('Applying migration to:', dbPath);

const db = new Database(dbPath);
const sql = fs.readFileSync(sqlPath, 'utf-8');

// Execute each statement
db.exec(sql);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables created:', tables.map(t => t.name).join(', '));
db.close();

console.log('Done!');
