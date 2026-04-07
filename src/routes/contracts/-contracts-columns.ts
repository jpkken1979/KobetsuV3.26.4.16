
/* ── Column definitions for TanStack Table ── */
export const contractColumns = [
  {
    id: "select",
    size: 40,
    header: "select",
  },
  {
    id: "contractNumber",
    accessorKey: "contractNumber",
    header: "契約番号",
    size: 160,
  },
  {
    id: "company",
    accessorKey: "company",
    header: "派遣先",
    size: 280,
  },
  {
    id: "status",
    accessorKey: "status",
    header: "状態",
    size: 100,
  },
  {
    id: "period",
    accessorKey: "endDate",
    header: "契約期間",
    size: 200,
  },
  {
    id: "actions",
    header: "操作",
    size: 80,
  },
] as const;
