import { type Contract } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ChevronRight, FileText, Search } from "lucide-react";

interface ContractSelectorProps {
  contracts: Contract[];
  isLoading: boolean;
  isError: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  selectedContractId: number | null;
  onSelectContract: (id: number) => void;
}

export function ContractSelector({
  contracts,
  isLoading,
  isError,
  searchValue,
  onSearchChange,
  selectedContractId,
  onSelectContract,
}: ContractSelectorProps) {
  return (
    <div className="flex flex-col gap-3 lg:col-span-1">
      <div className="rounded-xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-4">
          <h2 className="text-sm font-semibold">契約を選択</h2>
          <span className="rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {contracts.length}件
          </span>
        </div>

        <div className="p-3">
          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" aria-hidden="true" />
            <input
              type="search"
              placeholder="契約番号・企業名で絞込..."
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="契約検索"
              className="w-full rounded-lg border border-input/60 bg-background py-2 pl-8 pr-3 text-xs placeholder:text-muted-foreground/50 focus:border-primary/30 focus:outline-none focus:ring-1 focus:ring-primary/10"
            />
          </div>

          {isError ? (
            <p className="py-8 text-center text-sm text-destructive" role="alert" aria-live="polite">契約データの読み込みに失敗しました</p>
          ) : isLoading ? (
            <div className="space-y-2 p-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : contracts.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <FileText className="mb-2 h-8 w-8 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">有効な契約がありません</p>
            </div>
          ) : (
            <div className="max-h-[420px] space-y-1 overflow-y-auto">
              {contracts.map((contract: Contract) => (
                <button
                  key={contract.id}
                  onClick={() => onSelectContract(contract.id)}
                  className={cn(
                    "btn-press group w-full rounded-lg border p-3 text-left text-sm transition-all",
                    selectedContractId === contract.id
                      ? "border-primary/30 bg-primary/[0.04] ring-1 ring-primary/15 shadow-sm"
                      : "border-transparent hover:border-border/60 hover:bg-muted/20"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                      selectedContractId === contract.id
                        ? "bg-primary/10"
                        : "bg-muted/50 group-hover:bg-muted"
                    )}>
                      <FileText className={cn(
                        "h-3.5 w-3.5",
                        selectedContractId === contract.id ? "text-primary" : "text-muted-foreground/60"
                      )} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold tabular-nums">{contract.contractNumber}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{contract.company?.name}</p>
                    </div>
                    {selectedContractId === contract.id && (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary" />
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between pl-9">
                    <span className="text-[10px] tabular-nums text-muted-foreground/60">
                      {contract.startDate} ～ {contract.endDate}
                    </span>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      "bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary/90"
                    )}>
                      {contract.employees?.length || 0}名
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
