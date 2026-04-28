import { BatchPageShell } from "@/components/ui/batch-page-shell";
import { BentoStatsGrid, type BentoStat } from "@/components/ui/bento-stats-grid";
import { useDashboardStats } from "@/lib/hooks/use-dashboard-stats";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, FileCheck2, Layers, Package } from "lucide-react";
import { FactoryGenerator } from "./-factory-generator";

export const Route = createFileRoute("/documents/batch-factory")({
  component: BatchFactoryPage,
});

function BatchFactoryPage() {
  const { data: stats } = useDashboardStats();

  const heroStats = [
    { label: "派遣先", value: stats?.companies ?? 0 },
    { label: "工場ライン", value: stats?.factories ?? 0 },
    { label: "稼働契約", value: stats?.activeContracts ?? 0 },
  ] as const;

  const bentoStats: readonly BentoStat[] = [
    {
      label: "登録工場",
      value: stats?.factories ?? 0,
      hint: "全派遣先のラインを含む",
      icon: Layers,
      accent: "primary",
    },
    {
      label: "派遣先",
      value: stats?.companies ?? 0,
      hint: "稼働中のクライアント",
      icon: Building2,
      accent: "accent",
    },
    {
      label: "稼働契約",
      value: stats?.activeContracts ?? 0,
      hint: "工場一括の対象範囲",
      icon: FileCheck2,
      accent: "ok",
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <BatchPageShell
        title="工場一括生成"
        subtitle="工場ラインの全有効契約に対して一括でPDFを生成し、ZIPでダウンロードします"
        icon={Package}
        breadcrumb={["書類生成", "工場一括"]}
        badge="FACTORY BATCH"
        stats={heroStats}
      >
        <BentoStatsGrid stats={bentoStats} />
        <FactoryGenerator />
      </BatchPageShell>
    </div>
  );
}
