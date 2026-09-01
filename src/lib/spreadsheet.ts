import * as XLSX from "xlsx";

import {
  computedR,
  dayOf,
  holdMinutes,
  margin,
  netPnl,
  positionValue,
  riskDiscipline,
  rMultiple,
} from "./metrics";
import type { Direction, Outcome, Settings, Trade, TradeDraft } from "./types";

/** sessionStorage key used when a dashboard/trades upload loads one row into the form. */
export const IMPORT_DRAFT_KEY = "tj-import-draft";

/**
 * Every workbook flavour SheetJS can reasonably open. The file picker is a
 * hint, not a gate — detectSheet still tries to parse whatever was chosen.
 */
export const SPREADSHEET_ACCEPT = [
  ".xlsx",
  ".xlsm",
  ".xlsb",
  ".xls",
  ".xltx",
  ".xltm",
  ".xlt",
  ".xml",
  ".csv",
  ".txt",
  ".tsv",
  ".ods",
  ".fods",
  ".uos",
  ".sylk",
  ".slk",
  ".dif",
  ".dbf",
  ".prn",
  ".numbers",
  ".et",
  ".eth",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "application/vnd.oasis.opendocument.spreadsheet",
  "text/csv",
  "text/tab-separated-values",
  "text/plain",
].join(",");

/** Mechanical fields an uploaded sheet can populate. */
export type MechanicalKey =
  | "direction"
  | "coin"
  | "entryAt"
  | "exitAt"
  | "quantity"
  | "entryPrice"
  | "exitPrice"
  | "tradingFee"
  | "leverage"
  | "timeframe"
  | "strategy"
  | "plannedRr"
  | "plannedRisk"
  | "actualRisk"
  | "realizedR"
  | "realizedPnl"
  | "outcome"
  | "outcomeWin"
  | "outcomeLoss"
  | "outcomeBe";

/**
 * Header aliases, lower-cased and stripped of punctuation. Broker exports name
 * these columns a dozen different ways. Short tokens like "entry" are kept for
 * exact matches only; fuzzy matching requires a longer alias so "position value"
 * is not stolen by "position".
 */
const ALIASES: Record<MechanicalKey, string[]> = {
  direction: [
    "direction",
    "side",
    "positionaslongorshort",
    "positionlongshort",
    "longorshort",
    "longshort",
    "buysell",
    "position",
  ],
  coin: ["coin", "symbol", "ticker", "pair", "market", "instrument", "asset"],
  entryAt: [
    "tradeentrytimestamp",
    "entrytimestamp",
    "entrydatetime",
    "entrytime",
    "entrydate",
    "opentimestamp",
    "opendatetime",
    "opentime",
    "opendate",
    "opened",
    "datetime",
  ],
  exitAt: [
    "tradeexittimestamp",
    "exittimestamp",
    "exitdatetime",
    "exittime",
    "exitdate",
    "closetimestamp",
    "closedatetime",
    "closetime",
    "closedate",
    "closed",
  ],
  quantity: ["quantity", "qty", "size", "amount", "volume", "contracts", "filledsize"],
  entryPrice: ["entryprice", "openprice", "avgentryprice", "priceentry"],
  exitPrice: ["exitprice", "closeprice", "avgexitprice", "priceexit"],
  tradingFee: [
    "totalfee",
    "totalfees",
    "totalcommission",
    "tradingfee",
    "commission",
    "fees",
    "fee",
  ],
  leverage: ["leverage", "lev", "margindegree"],
  timeframe: ["timeframe", "tf", "interval"],
  strategy: ["strategytype", "strategy", "setup", "playbook", "system"],
  plannedRr: [
    "plannedrr",
    "plannedrandr",
    "plannedriskreward",
    "riskreward",
    "rewardratio",
    "plannedratio",
    "rrratio",
    "rr",
  ],
  plannedRisk: ["plannedrisk", "riskplanned", "intendedrisk", "riskamount"],
  actualRisk: ["actualrisk", "riskactual", "realrisk", "risktaken"],
  realizedR: [
    "netrr",
    "netrandr",
    "finalrr",
    "realizedrr",
    "realisedrr",
    "achievedrr",
    "actualrr",
  ],
  realizedPnl: [
    "realizedpnl",
    "realisedpnl",
    "realizedpl",
    "realisedpl",
    "netpnl",
    "netpl",
    "rpnl",
    "profitloss",
  ],
  outcome: [
    "winlossorbreakeven",
    "winlossbreakeven",
    "winlossorbreakenven",
    "winloss",
    "outcome",
    "result",
    "pnlresult",
  ],
  outcomeWin: ["iswin", "winner", "win"],
  outcomeLoss: ["isloss", "loser", "loss"],
  outcomeBe: ["breakeven", "breakenven", "scratch", "isbe"],
};

/**
 * Columns that exist on broker sheets but are not mechanical inputs here.
 * Files/images, IDs, computed values, and line-item fees (when a total exists)
 * are skipped so the rest of the row can still import.
 */
const IGNORED_PATTERNS: RegExp[] = [
  /^id$/,
  /^tradeid$/,
  /^tradeno/,
  /^tradenumber/,
  /^seq/,
  /^day$/,
  /^weekday/,
  /^dow$/,
  /^broker/,
  /^exchange$/,
  /^platform$/,
  /^account/,
  /file/,
  /image/,
  /screenshot/,
  /attachment/,
  /photo/,
  /unrealized/,
  /floating/,
  /^upnl$/,
  /rollover/,
  /^swap/,
  /overnight/,
  /positionvalue/,
  /positioinvalue/,
  /notional/,
  /^margin$/,
  /usedmargin/,
  /positionmargin/,
  /amountusedfortrade/,
];

function normalize(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isIgnored(needle: string): boolean {
  return IGNORED_PATTERNS.some((pattern) => pattern.test(needle));
}

function scoreAlias(needle: string, alias: string, key: MechanicalKey): number {
  if (!alias) return 0;
  if (needle === alias) {
    let score = 1000 + alias.length;
    if (key === "tradingFee" && alias.includes("total")) score += 80;
    return score;
  }
  // Header contains the alias: "trade entry timestamp" → entrytimestamp.
  if (alias.length >= 5 && needle.includes(alias)) {
    if (key === "direction" && /value|size|margin/.test(needle.replace(alias, ""))) {
      return 0;
    }
    let score = 100 + alias.length * 2 + Math.round((alias.length / needle.length) * 40);
    if (key === "tradingFee" && alias.includes("total")) score += 80;
    return score;
  }
  // Alias contains the header: "qty" → quantity.
  if (needle.length >= 4 && alias.includes(needle) && alias.length - needle.length <= 8) {
    return 40 + needle.length;
  }
  return 0;
}

function bestMatch(needle: string): { key: MechanicalKey; score: number } | null {
  let best: { key: MechanicalKey; score: number } | null = null;
  for (const [key, aliases] of Object.entries(ALIASES) as [MechanicalKey, string[]][]) {
    for (const alias of aliases) {
      const score = scoreAlias(needle, alias, key);
      if (score > 0 && (!best || score > best.score)) {
        best = { key, score };
      }
    }
  }
  return best;
}

export function mechanicalKeyFor(header: unknown): MechanicalKey | "ignored" | null {
  const needle = normalize(header);
  if (!needle) return null;
  if (isIgnored(needle)) return "ignored";
  return bestMatch(needle)?.key ?? null;
}

export interface DetectedSheet {
  sheetName: string;
  headerRow: number;
  columns: Partial<Record<MechanicalKey, number>>;
  unmatchedHeaders: string[];
  ignoredHeaders: string[];
  rows: Array<Partial<Record<MechanicalKey, unknown>>>;
}

type Matrix = unknown[][];

function scoreRow(row: unknown[]): {
  score: number;
  columns: Partial<Record<MechanicalKey, number>>;
  unmatched: string[];
  ignored: string[];
} {
  const claimed: Partial<Record<MechanicalKey, { index: number; score: number }>> = {};
  const unmatched: string[] = [];
  const ignored: string[] = [];

  row.forEach((cell, index) => {
    const label = String(cell ?? "").trim();
    if (!label) return;
    const needle = normalize(cell);
    if (isIgnored(needle)) {
      ignored.push(label);
      return;
    }
    const match = bestMatch(needle);
    if (!match) {
      unmatched.push(label);
      return;
    }
    const previous = claimed[match.key];
    if (!previous || match.score > previous.score) {
      if (previous) unmatched.push(String(row[previous.index] ?? "").trim());
      claimed[match.key] = { index, score: match.score };
    } else {
      unmatched.push(label);
    }
  });

  const columns: Partial<Record<MechanicalKey, number>> = {};
  for (const [key, hit] of Object.entries(claimed) as [
    MechanicalKey,
    { index: number; score: number },
  ][]) {
    columns[key] = hit.index;
  }
  return { score: Object.keys(columns).length, columns, unmatched, ignored };
}

function readWorkbook(buffer: ArrayBuffer): XLSX.WorkBook {
  const bytes = new Uint8Array(buffer);
  try {
    return XLSX.read(bytes, { type: "array", cellDates: true, raw: false });
  } catch {
    const text = new TextDecoder("utf-8").decode(bytes);
    return XLSX.read(text, { type: "string", cellDates: true, raw: false });
  }
}

/**
 * Scans each sheet for the row that looks most like a header, then treats
 * everything below it as the data section. Handles exports that start with
 * title rows, blank rows, or account summaries above the table.
 *
 * Unmatched columns are skipped, not rejected — a sheet only needs two
 * recognised mechanical headers to be treated as a trade table.
 */
export function detectSheet(buffer: ArrayBuffer, _filename?: string): DetectedSheet | null {
  const book = readWorkbook(buffer);
  let best: (DetectedSheet & { score: number }) | null = null;

  for (const sheetName of book.SheetNames) {
    const sheet = book.Sheets[sheetName];
    if (!sheet) continue;
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: null,
      raw: false,
    }) as Matrix;

    const limit = Math.min(matrix.length, 40);
    for (let i = 0; i < limit; i += 1) {
      const { score, columns, unmatched, ignored } = scoreRow(matrix[i] ?? []);
      if (score < 2) continue;
      if (best && score <= best.score) continue;

      const rows: Array<Partial<Record<MechanicalKey, unknown>>> = [];
      for (let r = i + 1; r < matrix.length; r += 1) {
        const raw = matrix[r] ?? [];
        const hasValue = raw.some((cell) => String(cell ?? "").trim() !== "");
        if (!hasValue) continue;
        const record: Partial<Record<MechanicalKey, unknown>> = {};
        let filled = false;
        for (const [key, index] of Object.entries(columns) as [MechanicalKey, number][]) {
          const value = raw[index];
          record[key] = value;
          if (String(value ?? "").trim() !== "") filled = true;
        }
        if (filled) rows.push(record);
      }

      best = {
        score,
        sheetName,
        headerRow: i + 1,
        columns,
        unmatchedHeaders: unmatched,
        ignoredHeaders: ignored,
        rows,
      };
    }
  }

  return best;
}

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/[^0-9.eE+-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "+" || cleaned === ".") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function excelSerialToStamp(serial: number): string | null {
  if (serial < 20000 || serial > 80000) return null;
  const utc = Date.UTC(1899, 11, 30) + serial * 86400000;
  const date = new Date(utc);
  if (Number.isNaN(date.getTime())) return null;
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toStamp(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const offset = value.getTimezoneOffset() * 60000;
    return new Date(value.getTime() - offset).toISOString().slice(0, 16);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return excelSerialToStamp(value);
  }
  const text = String(value).trim();
  if (!text) return null;
  const asNumber = Number(text);
  if (Number.isFinite(asNumber) && !text.includes("-") && !text.includes("T")) {
    const serial = excelSerialToStamp(asNumber);
    if (serial) return serial;
  }
  const parsed = new Date(text.includes("T") ? text : text.replace(" ", "T"));
  if (!Number.isNaN(parsed.getTime())) {
    const offset = parsed.getTimezoneOffset() * 60000;
    return new Date(parsed.getTime() - offset).toISOString().slice(0, 16);
  }
  return null;
}

function isChecked(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!text) return false;
  if (/^[✓✔☑x]$/i.test(text)) return true;
  return ["true", "yes", "y", "1", "checked", "check", "on"].includes(text);
}

function parseOutcome(value: unknown): Outcome | null {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  if (/[✓✔☑]/.test(text) && !/loss|lose/i.test(text)) return "win";
  const needle = normalize(value);
  if (!needle) return null;
  if (/^(win|winner|w|profit|yes|true|1|checked)$/.test(needle)) return "win";
  if (/^(loss|lose|loser|l|false)$/.test(needle) || needle.includes("loss")) return "loss";
  if (/^(be|breakeven|breakeven|breakenven|even|scratch|flat|0)$/.test(needle)) {
    return "breakeven";
  }
  if (needle.includes("win") && !needle.includes("loss")) return "win";
  if (needle.includes("even") || needle.includes("scratch")) return "breakeven";
  return null;
}

function parseRealizedR(value: unknown): number | null {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  const ratio = /^\s*(-?[\d.]+)\s*:\s*(-?[\d.]+)\s*$/.exec(text);
  if (ratio) {
    const risk = Number(ratio[1]);
    const reward = Number(ratio[2]);
    if (Number.isFinite(risk) && risk !== 0 && Number.isFinite(reward)) return reward / risk;
  }
  return toNumber(text.replace(/r$/i, ""));
}

/** Reverse net P&L into an exit price so the journal's computed P&L matches the sheet. */
function exitFromNetPnl(
  direction: Direction,
  entry: number,
  qty: number,
  net: number,
  fee: number,
): number | null {
  if (entry <= 0 || qty <= 0) return null;
  const move = (net + fee) / qty;
  const exit = direction === "long" ? entry + move : entry - move;
  return Number.isFinite(exit) && exit > 0 ? Number(exit.toFixed(8)) : null;
}

/** Applies one detected row on top of a draft, touching mechanical fields only. */
export function applyRow(
  base: TradeDraft,
  row: Partial<Record<MechanicalKey, unknown>>,
  settings: Settings,
): TradeDraft {
  const draft: TradeDraft = { ...base };

  const direction = normalize(row.direction);
  if (direction) {
    const mentionsShort = /short|sell/.test(direction) || direction === "s";
    const mentionsLong = /long|buy/.test(direction) || direction === "l";
    if (mentionsShort && !mentionsLong) draft.direction = "short";
    else if (mentionsLong && !mentionsShort) draft.direction = "long";
  }

  const coin = String(row.coin ?? "").trim();
  if (coin) {
    draft.coin = coin.toUpperCase().replace(/[-/_]?(USDT|USDC|USD|PERP)$/i, "");
  }

  const entryAt = toStamp(row.entryAt);
  if (entryAt) draft.entryAt = entryAt;
  const exitAt = toStamp(row.exitAt);
  if (exitAt) draft.exitAt = exitAt;
  else if (entryAt) draft.exitAt = entryAt;

  const quantity = toNumber(row.quantity);
  if (quantity != null) draft.quantity = Math.abs(quantity);
  const entryPrice = toNumber(row.entryPrice);
  if (entryPrice != null) draft.entryPrice = entryPrice;
  const exitPrice = toNumber(row.exitPrice);
  if (exitPrice != null) draft.exitPrice = exitPrice;
  const fee = toNumber(row.tradingFee);
  if (fee != null) draft.tradingFee = Math.abs(fee);
  const leverage = toNumber(row.leverage);
  if (leverage != null && leverage > 0) draft.leverage = leverage;
  const plannedRisk = toNumber(row.plannedRisk);
  if (plannedRisk != null) draft.plannedRisk = Math.abs(plannedRisk);
  const actualRisk = toNumber(row.actualRisk);
  if (actualRisk != null) draft.actualRisk = Math.abs(actualRisk);

  const realizedPnl = toNumber(row.realizedPnl);
  if (exitPrice == null && realizedPnl != null) {
    const derived = exitFromNetPnl(
      draft.direction,
      draft.entryPrice,
      draft.quantity,
      realizedPnl,
      draft.tradingFee,
    );
    if (derived != null) draft.exitPrice = derived;
  }

  const timeframe = String(row.timeframe ?? "").trim();
  if (timeframe) {
    const match = settings.timeframes.find((tf) => normalize(tf) === normalize(timeframe));
    draft.timeframe = match ?? timeframe;
  }

  const strategy = String(row.strategy ?? "").trim();
  if (strategy) {
    const match = settings.strategies.find((s) => normalize(s) === normalize(strategy));
    draft.strategy = match ?? strategy;
  }

  const rr = String(row.plannedRr ?? "").trim();
  if (rr) draft.plannedRr = rr.includes(":") ? rr : `1:${rr}`;

  const realizedR = parseRealizedR(row.realizedR);
  if (realizedR != null) draft.realizedR = realizedR;

  const fromColumn = parseOutcome(row.outcome);
  if (fromColumn) {
    draft.outcome = fromColumn;
  } else if (isChecked(row.outcomeWin)) {
    draft.outcome = "win";
  } else if (isChecked(row.outcomeLoss)) {
    draft.outcome = "loss";
  } else if (isChecked(row.outcomeBe)) {
    draft.outcome = "breakeven";
  }

  return draft;
}

export function rowLabel(row: Partial<Record<MechanicalKey, unknown>>): string {
  const parts = [
    String(row.coin ?? "").trim(),
    String(row.direction ?? "").trim(),
    String(row.entryAt ?? "").trim(),
    row.quantity != null ? `qty ${row.quantity}` : "",
  ].filter(Boolean);
  return parts.join(" · ") || "Row";
}

/** True when a mapped row has nothing the journal can store as a trade. */
export function isBlankImportRow(row: Partial<Record<MechanicalKey, unknown>>): boolean {
  const coin = String(row.coin ?? "").trim();
  const qty = toNumber(row.quantity);
  const entry = toNumber(row.entryPrice);
  const when = toStamp(row.entryAt);
  return !coin && (qty == null || qty === 0) && (entry == null || entry === 0) && !when;
}

/* -------------------------------------------------------------------------- */
/*                                   Export                                   */
/* -------------------------------------------------------------------------- */

export function exportTrades(trades: Trade[], settings: Settings): void {
  const rows = trades.map((trade) => {
    const discipline = riskDiscipline(trade);
    const base: Record<string, string | number | null> = {
      "Trade #": trade.seq,
      Direction: trade.direction,
      "Entry Timestamp": trade.entryAt.replace("T", " "),
      "Exit Timestamp": trade.exitAt.replace("T", " "),
      Day: dayOf(trade),
      Coin: trade.coin,
      Quantity: trade.quantity,
      "Entry Price": trade.entryPrice,
      "Exit Price": trade.exitPrice,
      "Position Value": round2(positionValue(trade)),
      Result: trade.outcome,
      "Trading Fee": trade.tradingFee,
      Leverage: trade.leverage,
      Margin: round2(margin(trade)),
      Timeframe: trade.timeframe,
      "Strategy Type": trade.strategy,
      "Net P&L": round2(netPnl(trade)),
      "Planned R:R": trade.plannedRr,
      "Final R": round2(rMultiple(trade)),
      "Computed R": round2(computedR(trade)),
      "Hold Minutes": holdMinutes(trade),
      "Planned Risk": trade.plannedRisk,
      "Actual Risk": trade.actualRisk,
      "Risk vs Plan": discipline ? discipline.label : "",
      Grade: trade.grade,
      "Quality Score %": trade.qualityScore,
      "Rules Followed": trade.rulesFollowed ? "Yes" : "No",
      "Rule Score %": trade.ruleScore,
      "Trade Reason": trade.tradeReason,
      "Exit Reason": trade.exitReason,
      Lesson: trade.lesson,
    };

    for (const question of settings.emotionQuestions) {
      base[question.label] = trade.emotions[question.id] ?? "";
    }
    for (const category of settings.tagCategories) {
      base[category.name] = trade.tags[category.id] ?? "";
    }
    base["Custom Tags"] = trade.customTags.join(", ");

    return base;
  });

  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Trades");
  XLSX.writeFile(book, `trading-journal-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function round2(value: number | null): number | null {
  return value == null ? null : Number(value.toFixed(2));
}

/** Blank sheet with the exact headers the importer understands. */
export function downloadTemplate(): void {
  const headers = [
    "Direction",
    "Coin",
    "Entry Timestamp",
    "Exit Timestamp",
    "Quantity",
    "Entry Price",
    "Exit Price",
    "Total Fee",
    "Leverage",
    "Timeframe",
    "Strategy Type",
    "Planned R&R",
    "Realized P&L",
    "Net R&R",
    "Planned Risk",
    "Actual Risk",
  ];
  const example = [
    "long",
    "BTC",
    "2026-08-30 09:15",
    "2026-08-30 10:05",
    0.25,
    64200,
    64950,
    3.2,
    10,
    "15M",
    "ChoCH Break",
    "1:3",
    184.3,
    3.7,
    50,
    50,
  ];
  const sheet = XLSX.utils.aoa_to_sheet([headers, example]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Trades");
  XLSX.writeFile(book, "trading-journal-template.xlsx");
}
