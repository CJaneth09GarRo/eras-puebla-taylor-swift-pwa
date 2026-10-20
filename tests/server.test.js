// Integration tests run the real server with a disposable SQLite database.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

const root = process.cwd();
let child;
let temporaryDirectory;
let baseUrl;

// Reserve an available port and wait until the child server can answer HTTP.
before(async () => {
  temporaryDirectory = mkdtempSync(join(tmpdir(), "eras-puebla-test-"));
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: { ...process.env, PORT: String(port), APP_DB_PATH: join(temporaryDirectory, "test.db") },
    stdio: "ignore"
  });

  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error(`Test server exited with code ${child.exitCode}.`);
    try {
      const response = await fetch(`${baseUrl}/api/eras`);
      if (response.ok) return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error("Test server did not start in time.");
});

// Stop the child before removing its SQLite file, including on Windows.
after(async () => {
  if (child && child.exitCode === null) {
    const exited = once(child, "exit");
    child.kill();
    await exited;
  }
  if (temporaryDirectory) rmSync(temporaryDirectory, { recursive: true, force: true });
});

test("API serves twelve eras with ten quiz tracks each", async () => {
  const response = await fetch(`${baseUrl}/api/eras`);
  const eras = await response.json();
  assert.equal(response.status, 200);
  assert.equal(eras.length, 12);
  assert.ok(eras.every(era => era.tracks.length >= 10));
  assert.equal(eras.find(era => era.key === "reputation").tracks[0].title, "...Ready For It?");
});

test("static files needed by the PWA remain available", async () => {
  for (const path of ["/", "/manifest.json", "/ServiceWorker.js", "/js/app.js", "/js/local-db.js", "/js/fan-tools.js"]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200, `${path} should be public`);
  }
});

test("database and retired community modules are not public", async () => {
  for (const path of ["/data/app.db", "/js/community.js", "/js/local-community-db.js", "/supabase/schema.sql"]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 404, `${path} should not be public`);
  }
});

test("catalog API is read-only", async () => {
  const response = await fetch(`${baseUrl}/api/eras`, { method: "POST" });
  assert.equal(response.status, 405);
});