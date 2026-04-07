/**
 * Shared PDF type definitions — Base interfaces for all document generators.
 *
 * Reduces duplication across 6 PDF generators by providing common
 * employee and contract data shapes.
 */

/** Base employee fields shared by all per-employee PDF documents. */
export interface BaseEmployee {
  fullName: string;
  katakanaName: string;
  gender: string | null;
  birthDate: string | null;
  actualHireDate: string | null;
  hireDate: string | null;
}

/** Employee with individual start/end dates (通知書, 管理台帳). */
export interface BaseEmployeeWithDates extends BaseEmployee {
  individualStartDate?: string | null;
  individualEndDate?: string | null;
  /** 派遣元社員番号 (UNS internal employee number) */
  employeeNumber?: string | null;
  /** 派遣先ID (client company employee ID) */
  clientEmployeeId?: string | null;
}

/** Employee with rate info (契約書, 派遣元管理台帳). */
export interface BaseEmployeeWithRate extends BaseEmployee {
  hourlyRate: number | null;
  billingRate?: number | null;
}

/** CellOpts for grid-based PDF cells (kobetsu-pdf, keiyakusho-pdf). */
export interface CellOpts {
  align?: "left" | "center" | "right";
  valign?: "top" | "center";
  wrap?: boolean;
  noBorder?: boolean;
  bg?: string;
  /** Per-side border control (koritsu PDFs). When any bX flag is set, noBorder is ignored. */
  bT?: boolean;
  bB?: boolean;
  bL?: boolean;
  bR?: boolean;
  /** Border line width override (default depends on generator). */
  bW?: number;
  /** Font override for this cell (e.g., "Gothic", "Century"). */
  font?: string;
  /** Faux bold: draws text twice with 0.3pt offset (no bold font needed). */
  bold?: boolean;
}
