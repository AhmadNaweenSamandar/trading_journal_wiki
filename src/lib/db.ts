import { promises as fs } from "node:fs";
import path from "node:path";

import { hydratePremarket } from "./premarket";
import { seedNotes } from "./seed";
import { DEFAULT_SETTINGS } from "./taxonomy";
import type { Biometrics, Focus, Note, Premarket, Settings, Trade } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const TRADES_FILE = path.join(DATA_DIR, "trades.json");
const NOTES_FILE = path.join(DATA_DIR, "notes.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const FOCUS_FILE = path.join(DATA_DIR, "focus.json");
const PREMARKET_FILE = path.join(DATA_DIR, "premarket.json");
const BIOMETRICS_FILE = path.join(DATA_DIR, "biometrics.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
export const SHOTS_DIR = path.join(DATA_DIR, "screenshots");

const BACKUPS_KEPT = 30;

/**
 * Copies the current file aside before it is overwritten, so a bad write or a
 * botched migration is always recoverable from data/backups.
 */
async function backup(file: string): Promise<void> {
  let existing: string;
  try {
    existing = await fs.readFile(file, "utf8");
  } catch {
    return;
  }

  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const base = path.basename(file, ".json");
  const at = new Date().toISOString().replace(/[:.]/g, "-");
  await fs.writeFile(path.join(BACKUP_DIR, `${base}-${at}.json`), existing, "utf8");

  const stale = (await fs.readdir(BACKUP_DIR))
    .filter((name) => name.startsWith(`${base}-`))
    .sort()
    .slice(0, -BACKUPS_KEPT);
  await Promise.all(stale.map((name) => fs.rm(path.join(BACKUP_DIR, name))));
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
    await writeJson(file, fallback);
    return fallback;
  }
}

async function writeJson<T>(file: string, value: T): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  // Write to a temp file first so an interrupted write cannot truncate the
  // journal, then swap it into place atomically.
  const temp = `${file}.tmp`;
  await fs.writeFile(temp, serialized, "utf8");
  await fs.rename(temp, file);
}

export async function getTrades(): Promise<Trade[]> {
  const trades = await readJson<Trade[]>(TRADES_FILE, []);
  // Back-fill sequence numbers for journals written before they existed.
  let highest = trades.reduce((max, t) => Math.max(max, t.seq ?? 0), 0);
  let changed = false;
  for (const trade of trades) {
    if (typeof trade.seq !== "number" || trade.seq <= 0) {
      highest += 1;
      trade.seq = highest;
      trade.id = String(highest);
      changed = true;
    }
  }
  if (changed) await saveTrades(trades);
  return trades;
}

/** Sequence numbers are never reused, so a gap means a deleted trade. */
export function nextSeq(trades: Trade[]): number {
  return trades.reduce((max, t) => Math.max(max, t.seq ?? 0), 0) + 1;
}

export async function saveTrades(trades: Trade[]): Promise<void> {
  await backup(TRADES_FILE);
  await writeJson(TRADES_FILE, trades);
}

export async function getTrade(id: string): Promise<Trade | undefined> {
  const trades = await getTrades();
  return trades.find((t) => t.id === id);
}

export async function getNotes(): Promise<Note[]> {
  return readJson<Note[]>(NOTES_FILE, seedNotes());
}

export async function saveNotes(notes: Note[]): Promise<void> {
  await writeJson(NOTES_FILE, notes);
}

export async function getNote(slug: string): Promise<Note | undefined> {
  const notes = await getNotes();
  return notes.find((n) => n.slug === slug);
}

export async function getSettings(): Promise<Settings> {
  const stored = await readJson<Partial<Settings>>(SETTINGS_FILE, DEFAULT_SETTINGS);
  // Merge so a settings file written by an older version keeps working.
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await backup(SETTINGS_FILE);
  await writeJson(SETTINGS_FILE, settings);
}

export async function getFocuses(): Promise<Focus[]> {
  return readJson<Focus[]>(FOCUS_FILE, []);
}

export async function saveFocuses(focuses: Focus[]): Promise<void> {
  await writeJson(FOCUS_FILE, focuses);
}

/** Newest first, so the most recent plan is always at the top of a list. */
export async function getPremarkets(): Promise<Premarket[]> {
  const records = await readJson<unknown[]>(PREMARKET_FILE, []);
  return records
    .map((record) => hydratePremarket(record))
    .filter((record) => record.date)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPremarket(date: string): Promise<Premarket | undefined> {
  return (await getPremarkets()).find((record) => record.date === date);
}

export async function savePremarkets(records: Premarket[]): Promise<void> {
  await backup(PREMARKET_FILE);
  await writeJson(PREMARKET_FILE, records);
}

/** Newest first. */
export async function getBiometrics(): Promise<Biometrics[]> {
  const records = await readJson<Biometrics[]>(BIOMETRICS_FILE, []);
  return [...records].sort((a, b) => b.date.localeCompare(a.date));
}

export async function saveBiometrics(records: Biometrics[]): Promise<void> {
  await backup(BIOMETRICS_FILE);
  await writeJson(BIOMETRICS_FILE, records);
}

export async function saveScreenshot(
  base64: string,
  extension: string,
): Promise<string> {
  await fs.mkdir(SHOTS_DIR, { recursive: true });
  const name = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.${extension}`;
  await fs.writeFile(path.join(SHOTS_DIR, name), Buffer.from(base64, "base64"));
  return `/api/screenshots/${name}`;
}

export async function readScreenshot(name: string): Promise<Buffer | null> {
  // Guard against path traversal in the requested file name.
  if (!/^[a-z0-9]+\.(png|jpg|jpeg|webp|gif)$/i.test(name)) return null;
  try {
    return await fs.readFile(path.join(SHOTS_DIR, name));
  } catch {
    return null;
  }
}

