import { Suspense, lazy, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatedPage } from "@/components/ui/animated";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { getAppSettings } from "@/lib/app-settings";
import {
  Table2,
  Terminal,
  Edit3,
  FileText,
  Users,
  Archive,
  BarChart3,
  Database,
  ShieldAlert,
} from "lucide-react";

const TableExplorerLazy = lazy(async () => {
  const mod = await import("./admin/-table-explorer");
  return { default: mod.TableExplorer };
});

const SqlRunnerLazy = lazy(async () => {
  const mod = await import("./admin/-sql-runner");
  return { default: mod.SqlRunner };
});

const ContractManagerLazy = lazy(async () => {
  const mod = await import("./admin/-contract-manager");
  return { default: mod.ContractManager };
});

const EmployeeManagerLazy = lazy(async () => {
  const mod = await import("./admin/-employee-manager");
  return { default: mod.EmployeeManager };
});

const BackupManagerLazy = lazy(async () => {
  const mod = await import("./admin/-backup-manager");
  return { default: mod.BackupManager };
});

const AuditExplorerLazy = lazy(async () => {
  const mod = await import("./admin/-audit-explorer");
  return { default: mod.AuditExplorer };
});

const StatsDashboardLazy = lazy(async () => {
  const mod = await import("./admin/-stats-dashboard");
  return { default: mod.StatsDashboard };
});

const AdminCrudTabLazy = lazy(async () => {
  const mod = await import("./admin/-crud-tab");
  return { default: mod.AdminCrudTab };
});

const TABS = [
  { id: "tables", label: "Tables", icon: Table2 },
  { id: "sql", label: "SQL", icon: Terminal },
  { id: "crud", label: "CRUD", icon: Edit3 },
  { id: "contracts", label: "Contracts", icon: FileText },
  { id: "employees", label: "Employees", icon: Users },
  { id: "backup", label: "Backup", icon: Archive },
  { id: "stats", label: "Stats", icon: BarChart3 },
  { id: "audit", label: "Audit", icon: Database },
] as const;

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  errorComponent: ({ reset }) => (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <p className="text-lg font-semibold text-destructive">エラーが発生しました</p>
      <button
        className="px-4 py-2 rounded-md border border-border bg-background text-sm"
        onClick={reset}
      >
        再試行
      </button>
    </div>
  ),
  pendingComponent: () => (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
    </div>
  ),
});

function AdminPage() {
  const [activeTab, setActiveTab] = useState<string>("tables");
  const adminMode = getAppSettings().adminMode;

  const tabFallback = (
    <div className="flex items-center justify-center py-14">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
    </div>
  );

  if (!adminMode) {
    return (
      <AnimatedPage>
        <PageHeader
          title="データベース管理"
          subtitle="Admin Database Panel"
        />
        <div className="p-6">
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border/60 bg-card p-12 text-center">
            <div className="rounded-full bg-amber-500/10 p-4">
              <ShieldAlert className="h-8 w-8 text-amber-500" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Modo Developer desactivado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Activá el Modo Developer en{" "}
                <a href="/settings" className="text-primary underline underline-offset-2">
                  Settings
                </a>{" "}
                para acceder a este panel.
              </p>
            </div>
          </div>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <PageHeader
        title="データベース管理"
        subtitle="Admin Database Panel"
      />
      <div className="p-6 space-y-4">
        {/* Tab navigation */}
        <div className="flex flex-wrap gap-1 p-1 bg-muted rounded-lg w-fit">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="mt-4">
          {activeTab === "tables" && (
            <Suspense fallback={tabFallback}>
              <TableExplorerLazy />
            </Suspense>
          )}
          {activeTab === "sql" && (
            <Suspense fallback={tabFallback}>
              <SqlRunnerLazy />
            </Suspense>
          )}
          {activeTab === "crud" && (
            <Suspense fallback={tabFallback}>
              <AdminCrudTabLazy />
            </Suspense>
          )}
          {activeTab === "contracts" && (
            <Suspense fallback={tabFallback}>
              <ContractManagerLazy />
            </Suspense>
          )}
          {activeTab === "employees" && (
            <Suspense fallback={tabFallback}>
              <EmployeeManagerLazy />
            </Suspense>
          )}
          {activeTab === "backup" && (
            <Suspense fallback={tabFallback}>
              <BackupManagerLazy />
            </Suspense>
          )}
          {activeTab === "stats" && (
            <Suspense fallback={tabFallback}>
              <StatsDashboardLazy />
            </Suspense>
          )}
          {activeTab === "audit" && (
            <Suspense fallback={tabFallback}>
              <AuditExplorerLazy />
            </Suspense>
          )}
        </div>
      </div>
    </AnimatedPage>
  );
}
