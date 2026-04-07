import { AnimatedPage } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { api, type Contract } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList, FileOutput, Hash, Package, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ContractSelector } from "./-contract-selector";
import { DocumentGenerator, DocumentGeneratorEmpty } from "./-document-generator";
import { FactoryGenerator } from "./-factory-generator";
import { IdGenerator } from "./-id-generator";
import { QuickGenerate, type KeiyakushoResult, type QuickGeneratedFile, type QuickGenerateResult } from "./-quick-generate";

export const Route = createFileRoute("/documents/")({
  component: DocumentsPage,
  errorComponent: ({ reset }) => (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <p className="text-lg font-semibold text-destructive">エラーが発生しました</p>
      <Button variant="outline" onClick={reset}>再試行</Button>
    </div>
  ),
});

interface GeneratedFile {
  type: string;
  filename: string;
  path: string;
}

interface GenerateResult {
  success: boolean;
  contractId: number;
  files: GeneratedFile[];
  summary: { total: number; errors: number };
}

type GenerationMode = "contract" | "factory" | "ids";

function DocumentsPage() {
  const [mode, setMode] = useState<GenerationMode>("contract");
  const [selectedContractId, setSelectedContractId] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [includeShugyojoken, setIncludeShugyojoken] = useState(false);
  const [contractSearch, setContractSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: contracts = [], isLoading: loadingContracts, isError: contractsError } = useQuery({
    queryKey: queryKeys.contracts.all(),
    queryFn: () => api.getContracts(),
  });

  const keiyakushoMutation = useMutation({
    mutationFn: async (params: { empNum: string; includeShugyojoken: boolean }) => {
      const keiyakusho = (await api.generateKeiyakusho(params.empNum)) as KeiyakushoResult;
      const files: QuickGeneratedFile[] = [
        {
          type: "keiyakusho",
          label: "労働契約書",
          filename: keiyakusho.filename,
          path: keiyakusho.path,
        },
      ];

      let shugyoError: string | undefined;
      if (params.includeShugyojoken) {
        try {
          const shugyo = (await api.generateShugyojoken(params.empNum)) as KeiyakushoResult;
          files.push({
            type: "shugyojoken",
            label: "就業条件明示書",
            filename: shugyo.filename,
            path: shugyo.path,
          });
        } catch (error) {
          shugyoError = error instanceof Error ? error.message : "就業条件明示書の生成に失敗しました";
        }
      }

      return { ...keiyakusho, files, shugyoError } satisfies QuickGenerateResult;
    },
    onSuccess: (data) => {
      toast.success("書類を生成しました", { description: data.files.map((f) => f.label).join(" + ") });
      if (data.shugyoError) {
        toast.warning("就業条件明示書は生成できませんでした", { description: data.shugyoError });
      }
    },
    onError: (error: Error) => {
      toast.error("契約書の生成に失敗しました", { description: error.message });
    },
  });

  const generateMutation = useMutation({
    mutationFn: (contractId: number) => api.generateContractDocuments(contractId) as Promise<GenerateResult>,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      toast.success("書類を生成しました", {
        description: `${data.files?.length || 0}件のPDFを生成`,
      });
    },
    onError: (error: Error) => {
      toast.error("書類の生成に失敗しました", { description: error.message });
    },
  });

  const { data: existingDocs } = useQuery({
    queryKey: queryKeys.documents.forContract(selectedContractId),
    queryFn: () => api.listDocuments(selectedContractId!),
    enabled: !!selectedContractId,
  });

  const activeContracts = contracts.filter(
    (c: Contract) => c.status === "active" || c.status === "draft"
  );

  const filteredContracts = activeContracts.filter((c: Contract) =>
    !contractSearch ||
    c.contractNumber?.includes(contractSearch) ||
    c.company?.name?.includes(contractSearch)
  );

  const selectedContract = contracts.find((c: Contract) => c.id === selectedContractId);

  return (
    <AnimatedPage className="space-y-6">
      {/* Header */}
      <PageHeader
        title="書類生成"
        tag="DOCUMENT_GENERATOR"
        subtitle="契約や社員番号から必要なPDFを生成・確認します"
      >
        <div className="hidden items-center gap-2 rounded-xl border border-border/60 bg-card px-4 py-2.5 shadow-[var(--shadow-card)] sm:flex">
          <FileOutput className="h-4 w-4 text-primary/70" />
          <span className="text-sm font-medium">5種類</span>
          <span className="text-xs text-muted-foreground">/ 契約</span>
        </div>
      </PageHeader>

      {/* Mode tabs: 契約別 | 工場一括 */}
      <div className="flex gap-1 rounded-xl border border-border/60 bg-muted/30 p-1">
        <button
          onClick={() => setMode("contract")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all",
            mode === "contract"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ClipboardList className="h-4 w-4" />
          契約別
        </button>
        <button
          onClick={() => setMode("factory")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all",
            mode === "factory"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Package className="h-4 w-4" />
          工場一括
        </button>
        <button
          onClick={() => setMode("ids")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all",
            mode === "ids"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Hash className="h-4 w-4" />
          ID指定
        </button>
      </div>

      {/* Factory mode */}
      {mode === "factory" && <FactoryGenerator />}

      {/* ID指定 mode */}
      {mode === "ids" && <IdGenerator />}

      {/* Contract mode */}
      {mode === "contract" && (
        <>
          {/* Quick keiyakusho generation */}
          <QuickGenerate
            employeeNumber={employeeNumber}
            onEmployeeNumberChange={setEmployeeNumber}
            includeShugyojoken={includeShugyojoken}
            onIncludeShugyojokenChange={setIncludeShugyojoken}
            keiyakushoMutation={keiyakushoMutation}
            onPreview={setPreviewUrl}
          />

          {/* Main grid — EmptyState cuando no hay contratos activos */}
          {!loadingContracts && activeContracts.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="有効な契約がありません"
              description="書類を生成するには、まず契約を作成してください"
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Left: Contract selector */}
                <ContractSelector
                  contracts={filteredContracts}
                  isLoading={loadingContracts}
                  isError={contractsError}
                  searchValue={contractSearch}
                  onSearchChange={setContractSearch}
                  selectedContractId={selectedContractId}
                  onSelectContract={(id) => {
                    setSelectedContractId(id);
                    setPreviewUrl(null);
                  }}
                />

                {/* Right: Document generation */}
                <div className="space-y-4 lg:col-span-2">
                  {!selectedContractId ? (
                    <DocumentGeneratorEmpty />
                  ) : (
                    <DocumentGenerator
                      selectedContractId={selectedContractId}
                      selectedContract={selectedContract}
                      generateMutation={generateMutation}
                      existingDocs={existingDocs}
                      previewUrl={previewUrl}
                      onPreview={setPreviewUrl}
                    />
                  )}
                </div>
              </div>

              {/* Quick preview for keiyakusho when no contract selected */}
              {previewUrl && !selectedContractId && (
                <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
                  <div className="flex items-center justify-between border-b border-border/60 p-3.5">
                    <h3 className="text-sm font-semibold">PDF プレビュー</h3>
                    <button
                      onClick={() => setPreviewUrl(null)}
                      aria-label="プレビューを閉じる"
                      className="btn-press rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <iframe
                    src={previewUrl}
                    className="h-[65vh] min-h-[420px] w-full"
                    title="PDF Preview"
                  />
                </div>
              )}
            </>
          )}
        </>
      )}
    </AnimatedPage>
  );
}
