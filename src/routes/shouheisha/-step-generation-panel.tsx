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
            {recruitsCount > 1
              ? `${recruitsCount}名分: 個別契約書 + 台帳 + 労働契約書を作成`
              : "2個の個別契約書 + 台帳 + 労働契約書を作成"}
          </>
        )}
      </Button>
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
            {recruitsCount > 1 ? `${recruitsCount}名分: 労働契約書だけ作成` : "労働契約書だけ作成"}
          </>
        )}
      </Button>
    </div>
  );
}