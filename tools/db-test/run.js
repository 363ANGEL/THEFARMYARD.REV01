/* Runs the Farmyard schema tests on an embedded Postgres: prelude (Supabase stubs),
   then the same composition bundle_tests.py builds — schema twice (re-run safety),
   test.sql, rollback. Exit 0 + "ALL TESTS PASSED" or exit 1 with the first error.
   Usage: node run.js */
const EmbeddedPostgres = require('embedded-postgres').default || require('embedded-postgres');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(root, 'supabase', f), 'utf8');
const schema = read('schema.sql')
  .replace(/^create extension if not exists pg_cron.*$/m, '-- pg_cron stubbed locally (see prelude.sql)');
const tests = read('test.sql');
const prelude = fs.readFileSync(path.join(__dirname, 'prelude.sql'), 'utf8');
const bundle = ['begin;', 'drop schema if exists fy cascade;', schema, schema, tests, 'rollback;'].join('\n');

const { Client } = require('pg');
const DATA = path.join(__dirname, '.pgdata');

// Kill a postmaster this harness started earlier (first line of postmaster.pid is its PID).
// embedded-postgres's stop() is unreliable on Windows, so each run cleans up itself.
function killStale(dir) {
  try {
    const pid = parseInt(fs.readFileSync(path.join(dir, 'postmaster.pid'), 'utf8').split('\n')[0], 10);
    if (pid > 0) { process.kill(pid); console.log('killed stale postmaster', pid); }
  } catch (e) { /* no pid file or already gone */ }
}

(async () => {
  killStale(DATA);
  await new Promise(r => setTimeout(r, 1500));
  fs.rmSync(DATA, { recursive: true, force: true });
  const pg = new EmbeddedPostgres({
    databaseDir: DATA,
    user: 'postgres', password: 'pw', port: 55432, persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });
  try {
    await pg.initialise();
    console.log('starting postgres...');
    await pg.start();
    const client = new Client({
      host: '127.0.0.1', port: 55432, user: 'postgres', password: 'pw',
      database: 'postgres', connectionTimeoutMillis: 15000,
    });
    await client.connect();
    try {
      await client.query(prelude);
      await client.query(bundle);
      console.log('ALL TESTS PASSED');
    } finally {
      await client.end().catch(() => {});
    }
  } catch (e) {
    console.error('FAIL:', e.message, e.where ? '\nwhere: ' + e.where : '');
    process.exitCode = 1;
  } finally {
    killStale(DATA);
    process.exit(process.exitCode || 0); // the embedded server keeps the event loop alive
  }
})();
