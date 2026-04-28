#!/usr/bin/env node
/**
 * Genera data/seed/*.example.json a partir de data/seed/*.json (reales).
 *
 * Política:
 *  - companies.example.json: mantiene nombres de empresa reales (公知 — registro
 *    mercantil) pero `representative` se nulifica.
 *  - factories.example.json: mantiene companyName/factoryName/lineName/workHours
 *    /bankAccount/calendar/etc. (no son PII de personas) pero anonimiza nombres
 *    de personas (supervisorName, commanderName, complaintClientName,
 *    complaintUnsName, managerUnsName).
 *  - employees.example.json: 100% sintético (nombres romaji, fechas, addresses).
 *    Mantiene `companyName` que referencia las empresas reales — el seed.ts
 *    matchea por substring includes, así que la FK queda válida.
 *
 * Uso:
 *   node scripts/anonymize-seeds.cjs
 *
 * Salida: data/seed/*.example.json (sobreescribe)
 *
 * Reproducible: misma entrada → misma salida (sin random sin seed).
 */

const fs = require("fs");
const path = require("path");

const SEED_DIR = path.resolve(__dirname, "..", "data", "seed");

function loadJson(filename) {
  const p = path.join(SEED_DIR, filename);
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function writeJson(filename, data) {
  const p = path.join(SEED_DIR, filename);
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf-8");
  console.log(`[anonymize] wrote ${filename} (${data.length} entries)`);
}

// PRNG determinístico (mulberry32) para que la salida sea estable
function seededRng(seed) {
  let state = seed >>> 0;
  return function () {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = seededRng(20260428);
function pick(arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// === Pools de datos sintéticos ===

const VIETNAMESE_FAMILY = [
  "NGUYEN", "TRAN", "LE", "PHAM", "HOANG", "HUYNH", "PHAN", "VU", "VO", "DANG",
  "BUI", "DO", "HO", "NGO", "DUONG", "LY", "TRINH", "DINH", "TRUONG", "MAI",
];
const VIETNAMESE_MIDDLE = ["VAN", "THI", "MINH", "HONG", "QUOC", "HUU", "DUC", "ANH", "BAO"];
const VIETNAMESE_GIVEN = [
  "HUNG", "NAM", "LINH", "HUONG", "AN", "BINH", "CUONG", "DUNG", "GIANG",
  "HAI", "KHANG", "LONG", "MINH", "NGOC", "PHUC", "QUANG", "SON", "TAI",
  "THANH", "TRUNG", "VINH", "YEN", "DAT", "HIEU", "KHOA", "LAM", "PHONG",
];

const KATAKANA_FIRST = [
  "グエン", "チャン", "レ", "ファム", "ホアン", "フイン", "ファン", "ヴー",
  "ヴォー", "ダン", "ブイ", "ドー", "ホ", "ンゴ", "ズオン", "リー",
];
const KATAKANA_MIDDLE = ["ヴァン", "ティ", "ミン", "ホン", "クオック", "フー", "ドゥック", "アイン"];
const KATAKANA_GIVEN = [
  "フン", "ナム", "リン", "フォン", "アン", "ビン", "クオン", "ズン",
  "ザン", "ハイ", "カン", "ロン", "ミン", "ンゴック", "フック",
];

const POSTAL_PREFIXES = ["100", "150", "160", "330", "440", "450", "460", "486", "498", "500"];
const ADDRESS_TEMPLATES = [
  "サンプル県サンプル市1-2-3 サンプル荘#{n}",
  "テスト県テスト市本町{n}番地",
  "サンプル県テスト町中央{n}-{m}",
];

const VISA_TYPES = [
  "技術・人文知識・国際業務",
  "技能実習2号ロ",
  "特定技能1号",
  "特定活動",
  "永住者",
  "定住者",
];

function makeFullName(idx) {
  const fam = pick(VIETNAMESE_FAMILY);
  const mid = pick(VIETNAMESE_MIDDLE);
  const giv = pick(VIETNAMESE_GIVEN);
  return `${fam} ${mid} ${giv}`;
}

function makeKatakanaName() {
  const fam = pick(KATAKANA_FIRST);
  const mid = pick(KATAKANA_MIDDLE);
  const giv = pick(KATAKANA_GIVEN);
  return `${fam}　${mid}　${giv}`;
}

function makeAddress() {
  const tpl = pick(ADDRESS_TEMPLATES);
  const n = Math.floor(rng() * 999) + 1;
  const m = Math.floor(rng() * 99) + 1;
  return tpl.replace("{n}", String(n)).replace("{m}", String(m));
}

function makePostalCode() {
  const prefix = pick(POSTAL_PREFIXES);
  const suffix = String(Math.floor(rng() * 9000) + 1000);
  return `${prefix}-${suffix}`;
}

function makeBirthDate() {
  // entre 1985 y 2003 (22-40 años en 2026)
  const year = 1985 + Math.floor(rng() * 19);
  const month = 1 + Math.floor(rng() * 12);
  const day = 1 + Math.floor(rng() * 28);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function makeHireDate() {
  // entre 2020 y 2025
  const year = 2020 + Math.floor(rng() * 6);
  const month = 1 + Math.floor(rng() * 12);
  const day = 1 + Math.floor(rng() * 28);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function makeVisaExpiry(hireDate) {
  // hireDate + 3-5 años
  const [y] = hireDate.split("-").map(Number);
  const yearsAhead = 3 + Math.floor(rng() * 3);
  return `${y + yearsAhead}-09-14`;
}

// === Anonimización ===

function anonymizeCompanies() {
  const real = loadJson("companies.json");
  const out = real.map((c) => ({
    ...c,
    representative: null,
  }));
  writeJson("companies.example.json", out);
}

function anonymizeFactories() {
  const real = loadJson("factories.json");
  const out = real.map((f, i) => {
    const dept = "サンプル課";
    return {
      ...f,
      supervisorName: f.supervisorName ? `主任　サンプル　太郎${(i % 10) + 1}` : null,
      commanderName: f.commanderName ? `工場長　サンプル　花子${(i % 10) + 1}` : null,
      complaintClientName: f.complaintClientName ? `主任　サンプル　次郎${(i % 10) + 1}` : null,
      complaintUnsName: f.complaintUnsName ? "営業部長　UNS　管理者" : null,
      managerUnsName: f.managerUnsName ? "営業部長　UNS　担当者" : null,
    };
  });
  writeJson("factories.example.json", out);
}

function anonymizeEmployees() {
  const real = loadJson("employees.json");
  const out = real.map((e, i) => {
    const empNumber = `EMP-${String(i + 1).padStart(4, "0")}`;
    const hireDate = makeHireDate();
    return {
      employeeNumber: empNumber,
      fullName: makeFullName(i),
      katakanaName: makeKatakanaName(),
      nationality: e.nationality || "ベトナム",
      gender: e.gender || (rng() < 0.7 ? "male" : "female"),
      birthDate: makeBirthDate(),
      hireDate,
      actualHireDate: hireDate,
      hourlyRate: e.hourlyRate ?? 1500,
      billingRate: e.billingRate ?? 2000,
      visaExpiry: makeVisaExpiry(hireDate),
      visaType: e.visaType && VISA_TYPES.includes(e.visaType) ? e.visaType : pick(VISA_TYPES),
      postalCode: makePostalCode(),
      address: makeAddress(),
      // CRÍTICO: companyName se preserva tal cual — los tests dependen de
      // strings exactos como "高雄" para R11 detection y el seed.ts hace
      // match por includes(). No anonimizar este campo.
      companyName: e.companyName,
      status: "active",
    };
  });
  writeJson("employees.example.json", out);
}

function main() {
  console.log("[anonymize] Generating synthetic seeds from real data...");
  anonymizeCompanies();
  anonymizeFactories();
  anonymizeEmployees();
  console.log("[anonymize] Done.");
}

main();
