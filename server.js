// Same-origin HTTP server: serves the PWA and a read-only SQLite catalogue API.
import { createServer } from "node:http";
import { readFileSync, mkdirSync, createReadStream } from "node:fs";
import { extname, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const root = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(root, "data/eras.json"), "utf8"));
const databasePath = resolve(process.env.APP_DB_PATH || join(root, "data/app.db"));
mkdirSync(dirname(databasePath), { recursive: true });
const database = new DatabaseSync(databasePath);
database.exec(`
  CREATE TABLE IF NOT EXISTS eras (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    year INTEGER NOT NULL,
    color_a TEXT NOT NULL,
    color_b TEXT NOT NULL,
    description TEXT NOT NULL,
    image TEXT NOT NULL,
    alt TEXT NOT NULL,
    genre TEXT NOT NULL DEFAULT '',
    aesthetic TEXT NOT NULL DEFAULT '',
    lead_single TEXT NOT NULL DEFAULT '',
    tracks_json TEXT NOT NULL DEFAULT '[]'
  )
`);

// Add missing catalogue columns without removing the user's existing SQLite data.
const existingColumns = new Set(database.prepare("PRAGMA table_info(eras)").all().map(column => column.name));
for (const [name, definition] of [
  ["genre", "TEXT NOT NULL DEFAULT ''"],
  ["aesthetic", "TEXT NOT NULL DEFAULT ''"],
  ["lead_single", "TEXT NOT NULL DEFAULT ''"],
  ["tracks_json", "TEXT NOT NULL DEFAULT '[]'"]
]) {
  if (!existingColumns.has(name)) database.exec(`ALTER TABLE eras ADD COLUMN ${name} ${definition}`);
}

const insertEra = database.prepare(`
  INSERT INTO eras
    (key, name, year, color_a, color_b, description, image, alt, genre, aesthetic, lead_single, tracks_json)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET
    name = excluded.name,
    year = excluded.year,
    color_a = excluded.color_a,
    color_b = excluded.color_b,
    description = excluded.description,
    image = excluded.image,
    alt = excluded.alt,
    genre = excluded.genre,
    aesthetic = excluded.aesthetic,
    lead_single = excluded.lead_single,
    tracks_json = excluded.tracks_json
`);
for (const era of data) {
  insertEra.run(
    era.key,
    era.name,
    era.year,
    era.colorA,
    era.colorB,
    era.description,
    era.image,
    era.alt,
    era.genre,
    era.aesthetic,
    era.leadSingle,
    JSON.stringify(era.tracks)
  );
}

const getEras = database.prepare(`
  SELECT key, name, year, color_a AS colorA, color_b AS colorB,
         description, image, alt, genre, aesthetic, lead_single AS leadSingle, tracks_json AS tracksJson
  FROM eras
  ORDER BY rowid
`);

// MIME types are explicit so SVG illustrations, stylesheets, scripts, and the manifest load correctly.
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-cache"
  });
  response.end(JSON.stringify(body));
}

// Route the catalogue API separately; static files are restricted to the public app allowlist.
const server = createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname === "/api/eras") {
    if (request.method !== "GET") return sendJson(response, 405, { error: "Method not allowed" });
    const eras = getEras.all().map(({ tracksJson, ...era }) => ({ ...era, tracks: JSON.parse(tracksJson) }));
    return sendJson(response, 200, eras);
  }
  if (url.pathname.startsWith("/api/")) return sendJson(response, 404, { error: "Not found" });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return sendJson(response, 405, { error: "Method not allowed" });
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  } catch {
    return sendJson(response, 400, { error: "Invalid path" });
  }
  const filePath = resolve(root, `.${pathname}`);
  const fileRelative = relative(root, filePath);
  if (fileRelative.startsWith(`..${sep}`) || fileRelative === "..") {
    return sendJson(response, 403, { error: "Forbidden" });
  }
  const publicFiles = new Set([
    "index.html",
    "manifest.json",
    "ServiceWorker.js",
    "sw.js",
    "css/styles.css",
    "js/app.js",
    "js/local-db.js",
    "js/fan-tools.js"
  ]);
  const publicPath = fileRelative.split(sep).join("/");
  if (!publicFiles.has(publicPath) && !publicPath.startsWith("assets/")) {
    return sendJson(response, 404, { error: "Not found" });
  }
  response.setHeader("Content-Type", contentTypes[extname(filePath)] || "application/octet-stream");
  response.setHeader("Cache-Control", "no-cache");
  const stream = createReadStream(filePath);
  stream.on("error", () => {
    if (!response.headersSent) sendJson(response, 404, { error: "Not found" });
    else response.destroy();
  });
  if (request.method === "HEAD") {
    stream.destroy();
    response.end();
  } else {
    stream.pipe(response);
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () => {
  console.log(`Eras Puebla disponible en http://localhost:${port}`);
  console.log(`SQLite: ${databasePath}`);
});

// Close both the listener and SQLite handle when the process is stopped by its host.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => {
    database.close();
    process.exit(0);
  }));
}