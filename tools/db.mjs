// Run a .sql file or a query string against DATABASE_URL (from .env.local) and print the results as tables.
//   node tools/db.mjs path/to/file.sql
//   node tools/db.mjs "select nickname, role from fy.member"
// The connection string and password are never printed. See WORKFLOW.md for when writes are allowed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function loadEnv() {
  const f = path.join(root, '.env.local');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
loadEnv();
const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is not set (put it in .env.local).'); process.exit(1); }

const arg = process.argv.slice(2).join(' ').trim();
if (!arg) { console.error('usage: node tools/db.mjs <file.sql | "query">'); process.exit(1); }
const isFile = /\.sql$/i.test(arg) && fs.existsSync(path.resolve(arg));
const sql = isFile ? fs.readFileSync(path.resolve(arg), 'utf8') : arg;

// Never let the URL or password reach the terminal, even inside an error message.
let secrets = [url];
try { const u = new URL(url); if (u.password) secrets.push(decodeURIComponent(u.password), u.password); } catch (e) { /* not a URL */ }
const scrub = s => secrets.reduce((t, x) => (x ? t.split(x).join('***') : t), String(s));

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  client.on('notice', n => console.log('notice:', scrub(n.message)));
  const res = await client.query(sql);               // simple protocol: a file may hold many statements
  for (const r of Array.isArray(res) ? res : [res]) {
    if (r.fields && r.fields.length) { console.table(r.rows); console.log(`(${r.rowCount} row${r.rowCount === 1 ? '' : 's'})`); }
    else console.log(`${r.command || 'OK'}${r.rowCount != null ? ' ' + r.rowCount : ''}`);
  }
} catch (e) {
  console.error('error:', scrub(e.message));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
