import { BatchPageShell } from "@/components/ui/batch-page-shell";
import { BentoStatsGrid, type BentoStat } from "@/components/ui/bento-stats-grid";
import { useDashboardStats } from "@/lib/hooks/use-dashboard-stats";
import { createFileRoute } from "@tanstack/react-router";
import { Hash, IdCard, ScanSearch, Users } from "lucide-react";
import { IdGenerator } from "./-id-generator";

export const Route = createFileRoute("/documents/batch-ids")({
  component: BatchIdsPage,
});

function BatchIdsPage() {
  const { data: stats } = useDashboardStats();

  const heroStats = [
    { label: "稼働社員", value: stats?.activeEmployees ?? 0 },
    { label: "派遣先", value: stats?.companies ?? 0 },
    { label: "稼働契約", value: stats?.activeContracts ?? 0 },
  ] as const;

  const bentoStats: readonly BentoStat[] = [
    {
      label: "稼働社員",
      value: stats?.activeEmployees ?? 0,
      hint: "ID指定で検索可能な対象",
      icon: Users,
      accent: "primary",
    },
    {
      label: "ID 形式",
      value: 2,
      hint: "派遣先ID または 派遣元番号",
      icon: IdCard,
      accent: "accent",
      format: () => "2",
    },
    {
      label: "稼働契約",
      value: stats?.activeContracts ?? 0,
      hint: "既存契約とのマッチ確認",
      icon: ScanSearch,
      accent: "ok",
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <BatchPageShell
        title="ID指定一括生成"
        subtitle="派遣先IDまたは派遣元番号を指定して、契約書を一括作成・PDFを生成します"
        icon={Hash}
        breadcrumb={["書類生成", "ID指定"]}
        badge="ID BATCH"
        stats={heroStats}
      >
        <BentoStatsGrid stats={bentoStats} />
        <IdGenerator />
      </BatchPageShell>
    </div>
  );
}
