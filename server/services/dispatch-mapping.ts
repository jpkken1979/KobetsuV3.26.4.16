/**
 * 派遣先 Dispatch Destination Mapping
 *
 * Maps abbreviated company names from 社員台帳 DBGenzaiX column 派遣先
 * to full company + factory names in TEXPERT TBKaisha master data.
 *
 * Pattern: "高雄工業 本社" → { company: "高雄工業株式会社", factory: "本社工場" }
 *
 * Based on analysis of 35 unique abbreviations → 14 companies (80 factory configs).
 */

export interface DispatchResolution {
  companyName: string;
  factoryName: string | null;
  verified: boolean;
}

/**
 * Static mapping: 派遣先 abbreviation → full company + factory names.
 *
 * Derived from cross-referencing:
 *   - 社員台帳 DBGenzaiX (1,051 employees, 35 unique 派遣先 values)
 *   - TEXPERT TBKaisha (14 companies, 80 configs)
 */
const DISPATCH_MAP: Record<string, DispatchResolution> = {
  // ── 高雄工業 (Takao Kogyo) — largest client, 5 locations ──
  "高雄工業 本社": {
    companyName: "高雄工業株式会社",
    factoryName: "本社工場",
    verified: true,
  },
  "高雄工業 海南第一": {
    companyName: "高雄工業株式会社",
    factoryName: "海南第一工場",
    verified: true,
  },
  "高雄工業 海南第二": {
    companyName: "高雄工業株式会社",
    factoryName: "海南第二工場",
    verified: true,
  },
  "高雄工業 静岡": {
    companyName: "高雄工業株式会社",
    factoryName: "第一工場",
    verified: true,
  },
  "高雄工業 岡山": {
    companyName: "高雄工業株式会社",
    factoryName: "HUB工場",
    verified: true,
  },

  // ── 加藤木材工業 (Katoh Mokuzai) — 2 locations ──
  "加藤木材工業 本社": {
    companyName: "加藤木材工業株式会社",
    factoryName: "本社工場",
    verified: true,
  },
  "加藤木材工業 春日井": {
    companyName: "加藤木材工業株式会社",
    factoryName: "春日井工場",
    verified: true,
  },

  // ── 瑞陵精機 (Zuiryo Seiki) — single location ──
  "瑞陵精機": {
    companyName: "瑞陵精機株式会社",
    factoryName: "恵那工場",
    verified: true,
  },

  // ── 川原鉄工所 (Kawahara Tekko) ──
  "川原鉄工所": {
    companyName: "株式会社川原鉄工所",
    factoryName: "本社工場",
    verified: true,
  },

  // ── 六甲電子 (Rokko Denshi) ──
  "六甲電子": {
    companyName: "六甲電子株式会社",
    factoryName: "本社工場",
    verified: true,
  },

  // ── オーツカ (Otsuka) ──
  "オーツカ": {
    companyName: "株式会社オーツカ",
    factoryName: "関ケ原工場",
    verified: true,
  },

  // ── ピーエムアイ (PMI) ──
  "ピーエムアイ": {
    companyName: "ピーエムアイ有限会社",
    factoryName: "本社工場",
    verified: true,
  },

  // ── 三幸技研 (Sanko Giken) ──
  "三幸技研": {
    companyName: "三幸技研株式会社",
    factoryName: "本社工場",
    verified: true,
  },

  // ── アサヒフォージ (Asahi Forge) ──
  "アサヒフォージ": {
    companyName: "アサヒフォージ株式会社",
    factoryName: "真庭工場",
    verified: true,
  },

  // ── ユアサ工機 (Yuasa Koki) — 3 locations ──
  "ユアサ工機 本社": {
    companyName: "ユアサ工機株式会社",
    factoryName: "本社工場",
    verified: true,
  },
  "ユアサ工機 新城": {
    companyName: "ユアサ工機株式会社",
    factoryName: "新城工場",
    verified: true,
  },
  "ユアサ工機 御津": {
    companyName: "ユアサ工機株式会社",
    factoryName: null,
    verified: false,
  },

  // ── 美鈴工業 (Misuzu Kogyo) — 2 locations ──
  "美鈴工業 本社": {
    companyName: "株式会社美鈴工業",
    factoryName: "本社工場",
    verified: true,
  },
  "美鈴工業 本庄": {
    companyName: "株式会社美鈴工業",
    factoryName: null,
    verified: false,
  },

  // ── セイビテック (Seivitec) ──
  "セイビテック": {
    companyName: "セイビテック株式会社",
    factoryName: null,
    verified: false,
  },

  // ── ﾃｨｰｹｰｴﾝｼﾞﾆｱﾘﾝｸﾞ (TK Engineering) — DB uses half-width katakana ──
  "ﾃｨｰｹｰｴﾝｼﾞﾆｱﾘﾝｸﾞ": {
    companyName: "ﾃｨｰｹｰｴﾝｼﾞﾆｱﾘﾝｸﾞ株式会社",
    factoryName: "海南第二工場",
    verified: true,
  },
  // Full-width alias for TKE
  "ティーケーエンジニアリング": {
    companyName: "ﾃｨｰｹｰｴﾝｼﾞﾆｱﾘﾝｸﾞ株式会社",
    factoryName: "海南第二工場",
    verified: true,
  },

  // ── フェニテックセミコンダクター (Phenitec) — 2 locations, DB uses (株) ──
  "ﾌｪﾆﾃｯｸｾﾐｺﾝﾀﾞｸﾀｰ 鹿児島": {
    companyName: "フェニテックセミコンダクター(株)",
    factoryName: "鹿児島工場",
    verified: true,
  },
  "ﾌｪﾆﾃｯｸｾﾐｺﾝﾀﾞｸﾀｰ 岡山": {
    companyName: "フェニテックセミコンダクター(株)",
    factoryName: null,
    verified: false,
  },
  // Full-width aliases for Phenitec
  "フェニテックセミコンダクター 鹿児島": {
    companyName: "フェニテックセミコンダクター(株)",
    factoryName: "鹿児島工場",
    verified: true,
  },
  "フェニテックセミコンダクター 岡山": {
    companyName: "フェニテックセミコンダクター(株)",
    factoryName: null,
    verified: false,
  },

  // ── Empresas adicionales (añadidas a client_companies por migrate-dispatch) ──
  "PATEC": {
    companyName: "PATEC株式会社",
    factoryName: null,
    verified: true,
  },
  "コーリツ 本社": {
    companyName: "コーリツ株式会社",
    factoryName: "本社工場",
    verified: true,
  },
  "コーリツ 州の崎": {
    companyName: "コーリツ株式会社",
    factoryName: "州の崎工場",
    verified: true,
  },
  "コーリツ 亀崎": {
    companyName: "コーリツ株式会社",
    factoryName: "亀崎工場",
    verified: true,
  },
  "コーリツ 乙川": {
    companyName: "コーリツ株式会社",
    factoryName: "乙川工場",
    verified: true,
  },
  "プレテック": {
    companyName: "プレテック株式会社",
    factoryName: null,
    verified: true,
  },
  "ワーク 志紀": {
    companyName: "ワーク株式会社",
    factoryName: "志紀",
    verified: true,
  },
  "ワーク 堺": {
    companyName: "ワーク株式会社",
    factoryName: "堺",
    verified: true,
  },
  "ワーク 岡山": {
    companyName: "ワーク株式会社",
    factoryName: "岡山",
    verified: true,
  },
  // ── Empresas históricas (sin empleados activos actualmente) ──
  "新日本ﾎｲｰﾙ工業": {
    companyName: "新日本ﾎｲｰﾙ工業",
    factoryName: null,
    verified: false,
  },
  "西岡工作所": {
    companyName: "西岡工作所",
    factoryName: null,
    verified: false,
  },
  "三芳": {
    companyName: "三芳",
    factoryName: null,
    verified: false,
  },
};

/**
 * Resolve a 派遣先 abbreviation to full company + factory names.
 *
 * Tries in order:
 *   1. Exact match in DISPATCH_MAP
 *   2. Fuzzy match (startsWith / includes)
 *   3. Returns raw input as company name with null factory
 */
export function resolveDispatch(hakensaki: string): DispatchResolution {
  const trimmed = hakensaki.trim();

  // 1. Exact match
  if (DISPATCH_MAP[trimmed]) {
    return DISPATCH_MAP[trimmed];
  }

  // 2. Fuzzy: check if any map key starts with or is contained in input
  for (const [key, resolution] of Object.entries(DISPATCH_MAP)) {
    if (trimmed.startsWith(key) || key.startsWith(trimmed)) {
      return resolution;
    }
  }

  // 3. Fallback: split on space — first part is company, second is factory hint
  const parts = trimmed.split(/\s+/);
  return {
    companyName: parts[0],
    factoryName: parts.length > 1 ? parts.slice(1).join(" ") : null,
    verified: false,
  };
}

/**
 * Get all known dispatch abbreviations for display/validation.
 */
export function getAllDispatchKeys(): string[] {
  return Object.keys(DISPATCH_MAP);
}

/**
 * Get full mapping for debugging/admin display.
 */
export function getFullDispatchMap(): Record<string, DispatchResolution> {
  return { ...DISPATCH_MAP };
}
