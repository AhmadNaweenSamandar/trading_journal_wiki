/**
 * Refreshes the built-in wiki pages in data/notes.json from the current seed
 * definitions, leaving any pages you wrote yourself untouched.
 *
 * Run with: node scripts/sync-notes.mjs [slug ...]
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = await fs.readFile(path.join(root, "src/lib/seed.ts"), "utf8");

const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const dataUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
const { seedNotes } = await import(dataUrl);

const seeded = seedNotes();
const only = process.argv.slice(2);
const wanted = only.length ? seeded.filter((n) => only.includes(n.slug)) : seeded;

const notesFile = path.join(root, "data/notes.json");
const existing = JSON.parse(await fs.readFile(notesFile, "utf8"));

let updated = 0;
let added = 0;
for (const note of wanted) {
  const index = existing.findIndex((n) => n.slug === note.slug);
  if (index === -1) {
    existing.push(note);
    added += 1;
    continue;
  }
  // Keep the reader's pin state, replace the content.
  existing[index] = { ...note, pinned: existing[index].pinned };
  updated += 1;
}

await fs.writeFile(notesFile, `${JSON.stringify(existing, null, 2)}\n`, "utf8");
console.log(`Synced wiki pages: ${updated} updated, ${added} added.`);
