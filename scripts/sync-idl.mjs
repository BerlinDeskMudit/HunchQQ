#!/usr/bin/env node
/**
 * Copies the Anchor-built IDL into the frontend.
 *
 * Usage:  node scripts/sync-idl.mjs
 * After:  anchor build   (produces target/idl/hunchqq.json)
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "target", "idl", "hunchqq.json");
const dest = join(root, "app", "src", "lib", "idl", "hunchqq.json");

if (!existsSync(source)) {
  console.error(`✗ ${source} not found — run \`anchor build\` first.`);
  process.exit(1);
}

mkdirSync(dirname(dest), { recursive: true });

// Normalize: pretty-print and ensure the address matches declare_id.
const idl = JSON.parse(readFileSync(source, "utf8"));
const anchorToml = readFileSync(join(root, "Anchor.toml"), "utf8");
const declared = anchorToml.match(/hunchqq\s*=\s*"([1-9A-HJ-NP-Za-km-z]+)"/);
if (declared && idl.address && idl.address !== declared[1]) {
  console.warn(`! IDL address ${idl.address} != Anchor.toml ${declared[1]} (run \`anchor keys sync\`)`);
}
writeFileSync(dest, JSON.stringify(idl, null, 2) + "\n");

// Also copy the generated types file if present (optional, used by tests).
const typesSrc = join(root, "target", "types", "hunchqq.ts");
if (existsSync(typesSrc)) {
  copyFileSync(typesSrc, join(root, "app", "src", "lib", "idl", "hunchqq.ts"));
}

console.log(`✓ IDL synced → ${dest}`);
