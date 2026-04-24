import { useMemo } from "react";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Factory as FactoryIcon,
  FileText,
  Loader2,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useCompanies } from "@/lib/hooks/use-companies";
import { useFactoryCascade } from "@/lib/hooks/use-factories";
import { cn } from "@/lib/utils";
import type { Factory } from "@/lib/api";

interface StepCompanySelectProps {
  companyId: number | null;
  factoryName: string;
  departmentName: string;
  lineId: number | null;
  onCompanyChange: (id: number) => void;
  onFactoryChange: (name: string) => void;
  onDepartmentChange: (name: string) => void;
  onLineChange: (factory: Factory) => void;
  selectedCompany: { name: string } | null;
  selectedFactoryLabel: string;
  selectedFactory: {
    id: number;
    factoryName: string;
    department: string;
    lineName: string;
    address: string;
    phone: string;
    jobDescription: string;
    jobDescription2: string;
    hourlyRate: number | null;
    shiftPattern: string;
    supervisorName: string;
    supervisorDept: string;
  } | null;
  selectedFactoryAddress: string;
  selectedFactoryPhone: string;
}

function pillClassName(active: boolean) {
  return cn(
    "w-full rounded-lg px-3 py-2 text-left text-sm transition-all",
    active ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted/60",
  );
}

export function StepCompanySelect({
  companyId,
  factoryName,
  departmentName,
  lineId,
  onCompanyChange,
  onFactoryChange,
  onDepartmentChange,
  onLineChange,
  selectedCompany,
  selectedFactoryLabel,
  selectedFactory,
  selectedFactoryAddress,
  selectedFactoryPhone,
}: StepCompanySelectProps) {
  const { data: companies = [] } = useCompanies();
  const { data: cascade, isLoading: cascadeLoading } = useFactoryCascade(companyId ?? 0);

  const factoryOptions = useMemo(() => Object.keys(cascade?.grouped ?? {}), [cascade]);
  const departmentOptions = useMemo(() => {
    if (!cascade?.grouped || !factoryName) return [];
    return Object.keys(cascade.grouped[factoryName] ?? {});
  }, [cascade, factoryName]);
  const lineOptions = useMemo(() => {
    if (!cascade?.grouped || !factoryName || !departmentName) return [];
    return cascade.grouped[factoryName]?.[departmentName] ?? [];
  }, [cascade, factoryName, departmentName]);

  return (
    <Card variant="default" className="p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">派遣先の選択</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          企業 → 工場 → 配属先 → ラインの順で選びます。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            企業
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border/60 p-2">
            {companies.map((company) => (
              <button
                key={company.id}
                onClick={() => onCompanyChange(company.id)}
                className={pillClassName(company.id === companyId)}
              >
                {company.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <FactoryIcon className="h-3.5 w-3.5" />
            工場
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border/60 p-2">
            {cascadeLoading && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                読み込み中...
              </div>
            )}
            {!cascadeLoading && factoryOptions.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">企業を選んでください</div>
            )}
            {factoryOptions.map((name) => (
              <button
                key={name}
                onClick={() => onFactoryChange(name)}
                className={pillClassName(name === factoryName)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            配属先
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border/60 p-2">
            {departmentOptions.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">工場を選んでください</div>
            )}
            {departmentOptions.map((name) => (
              <button
                key={name}
                onClick={() => onDepartmentChange(name)}
                className={pillClassName(name === departmentName)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            ライン
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border/60 p-2">
            {lineOptions.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">配属先を選んでください</div>
            )}
            {lineOptions.map((factory) => (
              <button
                key={factory.id}
                onClick={() => onLineChange(factory)}
                className={pillClassName(factory.id === lineId)}
              >
                {factory.lineName || "ライン未設定"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {(selectedCompany || selectedFactoryLabel) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-muted/30 px-3 py-3 text-sm">
          {selectedCompany && (
            <span className="rounded-md bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
              {selectedCompany.name}
            </span>
          )}
          {selectedFactoryLabel && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
              <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {selectedFactoryLabel}
              </span>
            </>
          )}
        </div>
      )}

      {selectedFactory && (
        <div className="mt-4 rounded-lg border border-border/60 bg-background/70 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            工場サマリー
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-muted/20 px-3 py-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">住所 / 連絡先</div>
              <div className="mt-1 text-sm text-foreground">{selectedFactoryAddress || "未設定"}</div>
              <div className="mt-1 text-xs text-muted-foreground">{selectedFactoryPhone || "電話未設定"}</div>
            </div>
            <div className="rounded-lg bg-muted/20 px-3 py-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">業務メモ</div>
              <div className="mt-1 text-sm text-foreground">
                {selectedFactory.jobDescription || selectedFactory.jobDescription2 || "未設定"}
              </div>
            </div>
            <div className="rounded-lg bg-muted/20 px-3 py-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">時給 / シフト</div>
              <div className="mt-1 text-sm text-foreground">
                {selectedFactory.hourlyRate ? `${selectedFactory.hourlyRate} 円` : "単価未設定"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {selectedFactory.shiftPattern || "シフト未設定"}
              </div>
            </div>
            <div className="rounded-lg bg-muted/20 px-3 py-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">責任者</div>
              <div className="mt-1 text-sm text-foreground">{selectedFactory.supervisorName || "未設定"}</div>
              <div className="mt-1 text-xs text-muted-foreground">{selectedFactory.supervisorDept || "部署未設定"}</div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────
// Page header section (separate from company step)
// ─────────────────────────────────────────────
interface PageHeaderSectionProps {
  onBackHref: string;
}

export function ShouheishaPageHeader({ onBackHref }: PageHeaderSectionProps) {
  return (
    <div className="flex items-center gap-4">
      <Link to={onBackHref} className="text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <PageHeader
        title="招聘者"
        tag="SHOUHEISHA"
        subtitle="外国人材の受け入れ用に、企業・工場・配属先を選び、必要書類を一括で作成します。工場マスタの担当者情報もそのまま反映し社員台帳に未登録でも使えます。"
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// Step indicators bar
// ─────────────────────────────────────────────
export function StepIndicatorBar() {
  return (
    <Card variant="default" className="p-4">
      <div className="grid gap-3 md:grid-cols-4">
        {["会社と工場を選ぶ", "招聘者の情報を入力", "価格と期間を設定", "ボタンで一括生成"].map((step, index) => (
          <div key={step} className="rounded-md border border-border/60 bg-background/70 px-4 py-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              STEP {index + 1}
            </div>
            <div className="text-sm font-medium">{step}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
