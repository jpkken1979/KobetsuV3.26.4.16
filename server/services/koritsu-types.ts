/**
 * Shared types between koritsu-excel-parser and koritsu-pdf-parser.
 * Extracted to break the circular import between the two modules.
 */

export interface KoritsuParsedFactory {
  factoryName: string;                   // 本社工場, 州の崎工場, 亀崎工場, 乙川工場
  department: string;                    // 製造1課, 品質課, 工務課
  lineName: string | null;              // 1工区, 品質係(本社), etc.
  hakensakiManagerName: string | null;  // 派遣先責任者 (課長)
  hakensakiManagerDept: string | null;
  hakensakiManagerRole: string | null;  // 派遣先責任者の役職 (課長, 係長)
  supervisorName: string | null;        // 指揮命令者 (工長/係長)
  supervisorDept: string | null;
  supervisorRole: string | null;        // 指揮命令者の役職 (工長, 班長)
  phone: string | null;
}

export interface KoritsuParsedResult {
  period: string;                        // "2025年 4月"
  factories: KoritsuParsedFactory[];
  addresses: Record<string, string>;     // factoryName → full address with postal code
  complaint: {
    name: string | null;
    dept: string | null;
    phone: string | null;
    fax: string | null;
  };
  overtime: {
    regular: string | null;
    threeShift: string | null;
  };
}