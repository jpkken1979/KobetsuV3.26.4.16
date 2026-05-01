import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { X, Download, FileText, ScrollText, BookMarked, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { api, downloadPdf } from "@/lib/api";

type GroupBy = "kobetsu" | "tsuchisho" | "daicho" | "kobetsu-tsuchisho" | "all";

interface GroupedDownloadModalProps {
  contractIds: number[];
  contractCount: number;
  employeeCount: number;
  onClose: () => void;
}

interface DownloadOption {
  value: GroupBy;
  label: string;
  desc: string;
  icon: React.ElementType;
}

const OPTIONS: DownloadOption[] = [
  {
    value: "kobetsu-tsuchisho",
    label: "契約書+通知書",
    desc: "個別契約書 と 通知書 をZIPでダウンロード",
    icon: Package,
  },
  {
    value: "kobetsu",
    label: "個別契約書 全部",
    desc: "全ての個別契約書 を1つのPDFに結合",
    icon: FileText,
  },
  {
    value: "tsuchisho",
    label: "通知書 全部",
    desc: "全ての通知書 を1つのPDFに結合",
    icon: ScrollText,
  },
  {
    value: "daicho",
    label: "管理台帳 全部",
    desc: "派遣先 + 派遣元台帳 を1つのPDFに結合",
    icon: BookMarked,
  },
  {
    value: "all",
    label: "全部ダウンロード",
    desc: "3種類全てをZIPでダウンロード",
    icon: Package,
  },
];

export function GroupedDownloadModal({
  contractIds,
  contractCount,
  employeeCount,
  onClose,
}: GroupedDownloadModalProps) {
  const [loading, setLoading] = useState<GroupBy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const handleDownload = async (groupBy: GroupBy) => {
    setLoading(groupBy);
    setError(null);

    try {
      const result = await api.generateGrouped(contractIds, groupBy);

      if (!result.success) {
        setError("PDF生成に失敗しました");
        return;
      }

      // Download each file
      for (const file of result.files) {
        await downloadPdf(file.path, file.filename);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <motion.div
        {...(shouldReduceMotion
          ? {}
          : {
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              exit: { opacity: 0 },
            })}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        {...(shouldReduceMotion
          ? {}
          : {
              initial: { opacity: 0, scale: 0.95, y: 10 },
              animate: { opacity: 1, scale: 1, y: 0 },
              exit: { opacity: 0, scale: 0.95, y: 10 },
              transition: { type: "spring", stiffness: 400, damping: 30 },
            })}
        className="relative z-10 w-full max-w-md rounded-xl border border-border/60 bg-card shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Download className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">PDFダウンロード</h3>
              <p className="text-[11px] text-muted-foreground">
                {contractCount}契約 / {employeeCount}社員
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-3 p-4">
          {/* Stats */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-lg bg-muted/30 border border-border/30 px-3 py-2 text-center">
              <p className="text-lg font-bold text-foreground">{contractCount}</p>
              <p className="text-[10px] text-muted-foreground">契約</p>
            </div>
            <div className="flex-1 rounded-lg bg-muted/30 border border-border/30 px-3 py-2 text-center">
              <p className="text-lg font-bold text-foreground">{employeeCount}</p>
              <p className="text-[10px] text-muted-foreground">社員</p>
            </div>
          </div>

          {/* Download options */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">
              ダウンロード形式を選択
            </p>
            <div className="space-y-1.5">
              {OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isLoading = loading === opt.value;

                return (
                  <button
                    key={opt.value}
                    onClick={() => handleDownload(opt.value)}
                    disabled={loading !== null}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-all",
                      "hover:border-primary/40 hover:bg-primary/[0.04]",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      "border-border/30 bg-card"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        opt.value === "all"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {isLoading ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">{opt.label}</p>
                      <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                    </div>
                    <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border/40 px-4 py-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading !== null}>
            キャンセル
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
