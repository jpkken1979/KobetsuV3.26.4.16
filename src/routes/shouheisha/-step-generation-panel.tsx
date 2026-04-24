import { FileDown, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GenerationPanelProps {
  recruitsCount: number;
  canGenerate: boolean;
  isBundlePending: boolean;
  isLaborOnlyPending: boolean;
  onBundle: () => void;
  onLaborOnly: () => void;
}

export function GenerationPanel({
  recruitsCount,
  canGenerate,
  isBundlePending,
  isLaborOnlyPending,
  onBundle,
  onLaborOnly,
}: GenerationPanelProps) {
  return (
    <div className="mt-5 grid gap-3">
      <div className="space-y-1.5">
        <Button
          className="w-full"
          disabled={!canGenerate || isBundlePending}
          onClick={onBundle}
        >
          {isBundlePending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <FileDown className="mr-2 h-4 w-4" />
              書類一式を作成
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          {recruitsCount > 1
            ? `${recruitsCount}名分の個別契約書・台帳・労働契約書をまとめて生成します。`
            : "個別契約書2部・台帳・労働契約書をまとめて生成します。"}
        </p>
      </div>
      <div className="space-y-1.5">
        <Button
          variant="outline"
          className="w-full"
          disabled={!canGenerate || isLaborOnlyPending}
          onClick={onLaborOnly}
        >
          {isLaborOnlyPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              労働契約書を作成中...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              労働契約書のみ作成
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          個別契約書や台帳を作らず、労働契約書だけを生成します。
        </p>
      </div>
    </div>
  );
}
