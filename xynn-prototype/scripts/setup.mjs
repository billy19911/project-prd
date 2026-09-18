#!/usr/bin/env node
/**
 * Satu perintah untuk menyiapkan & menjalankan server Xynn.
 *
 *   npm run setup   -> siapkan (.env, deps, DB, seed) lalu jalankan dev server
 *   npm run setup -- --no-dev  -> hanya siapkan, tanpa menjalankan server
 *
 * Idempotent: aman dijalankan berulang kali. Langkah yang sudah beres
 * (deps terpasang, migrasi diterapkan, plan ter-seed) akan dilewati.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const runDev = !process.argv.includes("--no-dev");

const log = (msg) => console.log(`\x1b[36m▸\x1b[0m ${msg}`);
const ok = (msg) => console.log(`\x1b[32m✓\x1b[0m ${msg}`);
const warn = (msg) => console.log(`\x1b[33m!\x1b[0m ${msg}`);

function fail(msg) {
  console.error(`\x1b[31m✗\x1b[0m ${msg}`);
  process.exit(1);
}

/** Jalankan perintah, teruskan stdio. */
function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: isWin,
    ...opts,
  });
  if (res.status !== 0) fail(`Perintah gagal: ${cmd} ${args.join(" ")}`);
}

/** Jalankan perintah, tangkap output; jangan hentikan program bila gagal. */
function capture(cmd, args) {
  return spawnSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    shell: isWin,
  });
}

// ---------------------------------------------------------------------------
// 1. Bootstrap .env
// ---------------------------------------------------------------------------
function setupEnv() {
  const envPath = path.join(root, ".env");
  const examplePath = path.join(root, ".env.example");

  if (!existsSync(envPath)) {
    if (!existsSync(examplePath)) fail(".env.example tidak ditemukan.");
    copyFileSync(examplePath, envPath);
    ok("Membuat .env dari .env.example");
  }

  let env = readFileSync(envPath, "utf8");
  const isPlaceholder = (val) =>
    !val || val.startsWith("your-") || /^0{32,}$/.test(val);

  const get = (key) => {
    const m = env.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\n]*)"?`, "m"));
    return m ? m[1].trim() : "";
  };
  const set = (key, val) =>
    (env = env.replace(new RegExp(`^${key}\\s*=.*$`, "m"), `${key}="${val}"`));

  // NEXTAUTH_SECRET: generate bila masih placeholder.
  if (isPlaceholder(get("NEXTAUTH_SECRET"))) {
    set("NEXTAUTH_SECRET", randomBytes(32).toString("base64"));
    ok("Generate NEXTAUTH_SECRET");
  }

  // ENCRYPTION_KEY: generate bila masih placeholder (32 byte hex).
  if (isPlaceholder(get("ENCRYPTION_KEY"))) {
    set("ENCRYPTION_KEY", randomBytes(32).toString("hex"));
    ok("Generate ENCRYPTION_KEY");
  }

  writeFileSync(envPath, env);
  return { env, get };
}

// ---------------------------------------------------------------------------
// 2. Dependencies
// ---------------------------------------------------------------------------
function setupDeps() {
  const marker = path.join(root, "node_modules", ".setup-stamp");
  if (existsSync(path.join(root, "node_modules")) && existsSync(marker)) {
    ok("Dependencies sudah terpasang (dilewati)");
    return;
  }
  log("Memasang dependencies (npm install)…");
  run("npm", ["install"]);
  writeFileSync(marker, new Date().toISOString());
  ok("Dependencies terpasang");
}

// ---------------------------------------------------------------------------
// 3. Database: migrate + generate
// ---------------------------------------------------------------------------
function setupDatabase() {
  log("Menerapkan migrasi database (prisma migrate deploy)…");
  const res = capture("npx", ["prisma", "migrate", "deploy"]);

  if (res.status !== 0) {
    console.error(res.stdout || "");
    console.error(res.stderr || "");
    fail(
      "Migrasi gagal. Pastikan PostgreSQL berjalan & DATABASE_URL di .env benar."
    );
  }
  if (res.stdout) console.log(res.stdout.trim());
  ok("Migrasi diterapkan");

  log("Membuat Prisma Client (prisma generate)…");
  run("npx", ["prisma", "generate"]);
  ok("Prisma Client siap");
}

// ---------------------------------------------------------------------------
// 4. Seed: plans (+ templates & features bila belum ada)
// ---------------------------------------------------------------------------
function setupSeed() {
  const seeds = [
    "prisma/seed-plans.mts",
    "prisma/seed-templates.mts",
    "prisma/seed-features.mts",
  ];
  const nodeArgs = [
    "--experimental-strip-types",
    "--disable-warning=ExperimentalWarning",
    "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
  ];

  for (const seed of seeds) {
    if (!existsSync(path.join(root, seed))) continue;
    log(`Seeding ${path.basename(seed)}…`);
    const res = capture("node", [...nodeArgs, seed]);
    if (res.status !== 0) {
      warn(`Seeding ${path.basename(seed)} dilewati (mungkin sudah terisi).`);
    } else {
      ok(`${path.basename(seed)} selesai`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
console.log("\n\x1b[1mXynn — Setup & Run\x1b[0m\n");

const { get } = setupEnv();

if (!get("DATABASE_URL")) {
  fail("DATABASE_URL kosong di .env — isi dulu lalu jalankan ulang.");
}
if (get("GOOGLE_CLIENT_ID").startsWith("your-")) {
  warn("GOOGLE_CLIENT_ID belum diisi — login Google tidak akan berfungsi.");
}

setupDeps();
setupDatabase();
setupSeed();

if (runDev) {
  console.log("");
  log("Menjalankan dev server… buka http://localhost:3000\n");
  run("npm", ["run", "dev"]);
} else {
  console.log("");
  ok("Setup selesai. Jalankan server dengan: npm run dev");
}
