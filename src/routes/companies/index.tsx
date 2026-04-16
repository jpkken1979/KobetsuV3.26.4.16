import { Suspense, lazy, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CompanyCard } from "./-company-card";
import { FactoryDrawer } from "./-factory-drawer";
import { CompanyEditDialog } from "./-company-edit-dialog";
import { CompanyYearlyConfigDialog } from "./-company-yearly-config";
import { useCompanies, useCreateCompany } from "@/lib/hooks/use-companies";
import type { Company } from "@/lib/api-types";

const FactoryImportTabLazy = lazy(async () => {
  const mod = await import("./-factory-import-tab");
  return { default: mod.FactoryImportTab };
});

export const Route = createFileRoute("/companies/")({
  component: CompaniesPage,
  errorComponent: ({ reset }) => (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <p className="text-lg font-semibold text-destructive">エラーが発生しました</p>
      <Button variant="outline" onClick={reset}>再試行</Button>
    </div>
  ),
});

function CompaniesPage() {
  const { data: companies } = useCompanies();
  const createCompany = useCreateCompany();
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [factoryEditorOpen, setFactoryEditorOpen] = useState(false);
  const [factoryId, setFactoryId] = useState<number | null>(null);
  const [tab, setTab] = useState("list");
  const [editCompanyOpen, setEditCompanyOpen] = useState(false);
  const [yearlyConfigCompany, setYearlyConfigCompany] = useState<Company | null>(null);

  const handleEditFactory = (id: number) => {
    setFactoryId(id);
    // Buscar la empresa dueña de la fábrica para pasarla al drawer
    const owner = companies?.find((co) => co.factories?.some((f) => f.id === id)) ?? null;
    setSelectedCompany(owner);
    setFactoryEditorOpen(true);
  };

  const handleAddFactory = (company: Company) => {
    setSelectedCompany(company);
    setFactoryId(null);
    setFactoryEditorOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="企業・工場管理"
        subtitle={`${companies?.length ?? 0} 社`}
      >
        <Button
          onClick={() => {
            const name = window.prompt("企業名:");
            if (name) createCompany.mutate({ name });
          }}
        >
          <Building2 className="h-4 w-4 mr-2" />
          新規企業
        </Button>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList>
          <TabsTrigger value="list">一覧</TabsTrigger>
          <TabsTrigger value="import">インポート</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-4">
          <div className="grid gap-4">
            {companies?.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="企業が登録されていません"
                description="「新規企業」ボタンから最初の企業を追加してください"
              />
            ) : (
              companies?.map((co) => (
                <CompanyCard
                  key={co.id}
                  company={co}
                  onEdit={(company) => {
                    setSelectedCompany(company);
                    setEditCompanyOpen(true);
                  }}
                  onAddFactory={handleAddFactory}
                  onEditFactory={handleEditFactory}
                  onYearlyConfig={(company) => setYearlyConfigCompany(company)}
                />
              ))
            )}
          </div>
        </TabsContent>
        <TabsContent value="import" className="mt-4">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
              </div>
            }
          >
            <FactoryImportTabLazy />
          </Suspense>
        </TabsContent>
      </Tabs>

      {factoryEditorOpen && selectedCompany && (
        <FactoryDrawer
          companyId={selectedCompany.id}
          editingId={factoryId}
          onClose={() => {
            setFactoryEditorOpen(false);
            setSelectedCompany(null);
          }}
        />
      )}

      <CompanyEditDialog
        company={selectedCompany}
        open={editCompanyOpen}
        onOpenChange={setEditCompanyOpen}
      />

      {yearlyConfigCompany && (
        <CompanyYearlyConfigDialog
          companyId={yearlyConfigCompany.id}
          companyLabel={yearlyConfigCompany.shortName ?? yearlyConfigCompany.name}
          open={yearlyConfigCompany !== null}
          onClose={() => setYearlyConfigCompany(null)}
        />
      )}
    </div>
  );
}
