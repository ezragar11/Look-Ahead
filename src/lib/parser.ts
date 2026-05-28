/**
 * LookAhead Pro — Excel Parser
 *
 * Parses construction 3-week lookahead .xlsx files.
 *
 * Expected structure (0-indexed rows):
 *   Row 4  → "CONTRACT No." / "Project Description:" / project name
 *   Row 5  → Lookahead title (e.g. "3-Week Look Ahead")
 *   Row 9  → Column labels: LOCATION, Actual Start, Planned Finish, Actual Finish, History
 *   Row 10 → Excel serial dates (month anchors) at week-group start columns
 *   Row 11 → Week labels: "Last Week", "First Week", "Second Week", etc.
 *   Row 12 → Day-of-month numbers (18, 19, 20 …)
 *   Row 13 → Day-of-week labels (M, T, W, Th, F, S, S)
 *   Row 14+ → Category rows (col 0 has text, col 1 is blank)
 *              Activity rows (col 1 has activity description)
 *
 *   Columns 0–6:  ID, Activity Description, Subcontractor, Location, Actual Start, Planned Finish, Actual Finish
 *   Columns 7–41: Date columns — "X" or "x" marks planned work days
 */

import * as XLSX from "xlsx";
import type { ParsedActivity, ParsedLookahead, ParsedOccurrence } from "@/types";

// ─── Row / column constants ───────────────────────────────────────────────────

const ROW_PROJECT_NAME   = 4;   // 0-indexed
const ROW_TITLE          = 5;
const ROW_SERIAL_DATES   = 10;
const ROW_WEEK_LABELS    = 11;
const ROW_DAY_NUMBERS    = 12;
const ROW_DAY_NAMES      = 13;
const ROW_ACTIVITIES_START = 14;

const COL_ACTIVITY_DESC  = 1;
const COL_SUBCONTRACTOR  = 2;
const COL_LOCATION       = 3;
const COL_ACTUAL_START   = 4;
const COL_PLANNED_FINISH = 5;
const COL_ACTUAL_FINISH  = 6;
const COL_DATES_START    = 7;   // First date column (H)
const COL_DATES_END      = 41;  // Last date column (AP)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cellStr(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val).trim().replace(/\s+/g, " ");
}

function isXMark(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  return String(val).trim().toLowerCase() === "x";
}

/** Convert Excel serial number (e.g. 46143 → 2026-05-01) to JS Date */
function excelSerial(serial: number): Date {
  return new Date((serial - 25569) * 86400 * 1000);
}

/** Parse an Excel date cell (serial number or JS Date from xlsx) */
function parseExcelDate(val: unknown): Date | undefined {
  if (!val) return undefined;
  if (typeof val === "number") return excelSerial(val);
  if (val instanceof Date) return val;
  return undefined;
}

// ─── Build date column map ─────────────────────────────────────────────────

interface DateColInfo {
  colIndex:   number;
  date:       Date;
  weekLabel:  string;
  dayOfWeek:  string;
}

function buildDateColumns(
  serialRow: unknown[],
  weekLabelRow: unknown[],
  dayNumberRow: unknown[],
  dayNameRow: unknown[]
): DateColInfo[] {
  const result: DateColInfo[] = [];

  // Find month anchors: cells in serialRow that contain large numbers (Excel serials)
  // These sit at the first column of each month group.
  // E.g. col 7 = serial for May 1, col 21 = serial for June 1
  const anchors: { col: number; date: Date }[] = [];
  for (let c = COL_DATES_START; c <= COL_DATES_END; c++) {
    const v = serialRow[c];
    if (typeof v === "number" && v > 40000) {
      anchors.push({ col: c, date: excelSerial(v) });
    }
  }

  // Build date for each column using the month anchors + day numbers
  // Strategy: walk left-to-right; when day number decreases, advance to next anchor month
  let anchorIdx = 0;
  let prevDayNum = -1;

  for (let c = COL_DATES_START; c <= COL_DATES_END; c++) {
    const dayNum = typeof dayNumberRow[c] === "number" ? dayNumberRow[c] as number : null;
    if (dayNum === null) continue;

    // Detect month rollover (day number decreases, e.g. 31 → 1)
    if (prevDayNum > 0 && dayNum < prevDayNum && anchorIdx + 1 < anchors.length) {
      anchorIdx++;
    }
    prevDayNum = dayNum;

    // Use the anchor month/year but override the day
    const anchorDate = anchors[anchorIdx]?.date ?? new Date();
    const year  = anchorDate.getUTCFullYear();
    const month = anchorDate.getUTCMonth(); // 0-based

    const date = new Date(Date.UTC(year, month, dayNum));

    // Week label — look back in weekLabelRow for nearest non-empty label
    let weekLabel = "";
    for (let wc = c; wc >= COL_DATES_START; wc--) {
      const wl = weekLabelRow[wc];
      if (wl && typeof wl === "string" && wl.trim()) {
        weekLabel = wl.trim();
        break;
      }
    }

    const dayOfWeek = cellStr(dayNameRow[c]);

    result.push({ colIndex: c, date, weekLabel, dayOfWeek });
  }

  return result;
}

// ─── Main parser ─────────────────────────────────────────────────────────────

export function parseLookaheadFile(buffer: Buffer): ParsedLookahead {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });

  // Find the schedule sheet (first, or one named "Schedule")
  const sheetName =
    workbook.SheetNames.find((n) => n.toLowerCase().includes("schedule")) ??
    workbook.SheetNames[0];

  if (!sheetName) throw new Error("No sheets found in workbook");

  const sheet = workbook.Sheets[sheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    blankrows: true,
  }) as unknown[][];

  // ── Project name & title ──────────────────────────────────────────────────
  let projectName = "Unknown Project";
  let lookaheadName = "3-Week Look Ahead";

  // Scan rows 0–8 for project name and title
  for (let r = 0; r <= Math.min(8, rows.length - 1); r++) {
    const row = rows[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const v = cellStr(row[c]);
      if (
        v.length > 5 &&
        !v.toUpperCase().startsWith("CONTRACT") &&
        !v.toUpperCase().startsWith("CONTRACTOR") &&
        !v.toUpperCase().startsWith("PROJECT DESCRIPTION") &&
        v.match(/[A-Za-z]{3}/) // at least 3 letters
      ) {
        if (v.toLowerCase().includes("look ahead") || v.toLowerCase().includes("lookahead")) {
          lookaheadName = v;
        } else if (
          (v.includes("/") || v.toLowerCase().includes("substation") || v.toLowerCase().includes("project")) &&
          projectName === "Unknown Project"
        ) {
          projectName = v;
        }
      }
    }
  }

  // ── Date column map ───────────────────────────────────────────────────────
  const serialRow    = rows[ROW_SERIAL_DATES]    ?? [];
  const weekLabelRow = rows[ROW_WEEK_LABELS]     ?? [];
  const dayNumberRow = rows[ROW_DAY_NUMBERS]     ?? [];
  const dayNameRow   = rows[ROW_DAY_NAMES]       ?? [];

  const dateColumns = buildDateColumns(serialRow, weekLabelRow, dayNumberRow, dayNameRow);

  if (dateColumns.length === 0) {
    throw new Error("Could not detect date columns. Check that the file follows the expected format.");
  }

  const startDate = dateColumns[0].date;
  const endDate   = dateColumns[dateColumns.length - 1].date;

  // ── Activity rows ─────────────────────────────────────────────────────────
  const activities: ParsedActivity[] = [];
  let currentCategory = "GENERAL";

  for (let r = ROW_ACTIVITIES_START; r < rows.length; r++) {
    const row = rows[r] ?? [];

    const col0 = cellStr(row[0]);
    const col1 = cellStr(row[COL_ACTIVITY_DESC]);

    // Blank row
    if (!col0 && !col1) continue;

    // Category row: col 0 has text, col 1 is blank
    if (col0 && !col1) {
      currentCategory = col0;
      continue;
    }

    // Activity row: col 1 has text
    if (!col1) continue;

    const subRaw  = cellStr(row[COL_SUBCONTRACTOR]);
    const loc     = cellStr(row[COL_LOCATION]);

    // Parse actual start/finish if provided as Excel serial or date
    const actualStartRaw  = row[COL_ACTUAL_START];
    const plannedFinishRaw = row[COL_PLANNED_FINISH];
    const actualFinishRaw = row[COL_ACTUAL_FINISH];

    const actualStart   = parseExcelDate(actualStartRaw);
    const plannedFinish = parseExcelDate(plannedFinishRaw);
    const actualFinish  = parseExcelDate(actualFinishRaw);

    // Build occurrences from X marks
    const occurrences: ParsedOccurrence[] = [];
    for (const dc of dateColumns) {
      if (isXMark(row[dc.colIndex])) {
        occurrences.push({
          plannedDate:      dc.date,
          plannedWeekLabel: dc.weekLabel,
          dayOfWeek:        dc.dayOfWeek,
        });
      }
    }

    // Derive plannedStart from first occurrence if not set
    const derivedPlannedStart =
      occurrences.length > 0 ? occurrences[0].plannedDate : undefined;
    const derivedPlannedFinish =
      occurrences.length > 0 ? occurrences[occurrences.length - 1].plannedDate : undefined;

    activities.push({
      category:                    currentCategory,
      activityDescription:         col1,
      responsibleSubcontractorRaw: subRaw,
      location:                    loc,
      plannedStart:                derivedPlannedStart,
      plannedFinish:               plannedFinish ?? derivedPlannedFinish,
      actualStart:                 actualStart,
      actualFinish:                actualFinish,
      occurrences,
    });
  }

  return {
    projectName,
    lookaheadName,
    startDate,
    endDate,
    activities,
  };
}
