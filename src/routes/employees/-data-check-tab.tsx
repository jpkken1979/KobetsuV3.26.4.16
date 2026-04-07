import { useState } from "react";
import { Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEmployeeCompleteness } from "@/lib/hooks/use-employees";
import type { CompletenessLevel } from "@/lib/api-types";

const levelColors: Record<CompletenessLevel, string> = {
  green: "bg-green-100 text-green-800",
  yellow: "bg-yellow-100 text-yellow-800",
  red: "bg-red-100 text-red-800",
  gray: "bg-gray-100 text-gray-800",
};

export function DataCheckTab() {
  const { data: rows } = useEmployeeCompleteness();
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = (rows ?? []).filter((r) => {
    if (filterLevel !== "all" && r.level !== filterLevel) return false;
    if (
      search &&
      !r.fullName.includes(search) &&
      !r.employeeNumber.includes(search)
    )
      return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="社員番号・氏名で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="all">全て</option>
          <option value="green">green</option>
          <option value="yellow">yellow</option>
          <option value="red">red</option>
        </select>
      </div>

      <Card>
        <div className="overflow-auto max-h-[calc(100vh-300px)]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm">
              <tr className="border-b border-border/80 text-xs uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3 text-left font-semibold">社員番号</th>
                <th className="px-4 py-3 text-left font-semibold">氏名</th>
                <th className="px-4 py-3 text-left font-semibold">工場</th>
                <th className="px-4 py-3 text-left font-semibold">派遣先</th>
                <th className="px-4 py-3 text-left font-semibold">状態</th>
                <th className="px-4 py-3 text-left font-semibold">不足フィールド</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.employeeId}
                  className="border-b border-border/50 last:border-0 hover:bg-primary/5 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {row.employeeNumber}
                  </td>
                  <td className="px-4 py-3 text-sm">{row.fullName}</td>
                  <td className="px-4 py-3 text-sm">{row.factoryName ?? "-"}</td>
                  <td className="px-4 py-3 text-sm">{row.companyName ?? "-"}</td>
                  <td className="px-4 py-3">
                    <Badge className={levelColors[row.level]}>{row.level}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {row.missingEmployee.length > 0 && (
                      <div className="text-red-600">
                        社員: {row.missingEmployee.join(", ")}
                      </div>
                    )}
                    {row.missingFactory.length > 0 && (
                      <div className="text-yellow-600">
                        工場: {row.missingFactory.join(", ")}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
