import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { X, FileText, Package, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SetOptions {
  kobetsuCopies: 1 | 2;
  includeSeparate: boolean;
  includeAllInOne: boolean;
}

export function SetOptionsModal({
  companyName,
  factoryInfo,
  contractCount,
  employeeCount,
  onGenerate,
  onClose,
}: {
  companyName: string;
  factoryInfo: string;
  contractCount: number;
  employeeCount: number;
  onGenerate: (options: SetOptions) => void;
  onClose: () => void;
}) {
  const [copies, setCopies] = useState<1 | 2>(2);
  const [includeSeparate, setIncludeSeparate] = useState(true);
  const [includeAllInOne, setIncludeAllInOne] = useState(true);
  const shouldReduceMotion = useReducedMotion();

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
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">SET生成オプション</h3>
              <p className="text-[11px] text-muted-foreground">
                {companyName} — {factoryInfo}
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
        <div className="space-y-4 p-4">
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

          {/* Kobetsu copies */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Copy className="h-3.5 w-3.5 text-primary" />
              個別契約書の部数
            </label>
            <div className="space-y-1.5">
              {([
                { value: 2 as const, label: "2部（甲用＋乙用）", desc: "企業と自社用 — 推奨" },
                { value: 1 as const, label: "1部のみ", desc: "自社保管用" },
              ]).map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-all",
                    copies === opt.value
                      ? "border-primary/40 bg-primary/[0.06]"
                      : "border-border/30 hover:border-border/60"
                  )}
                >
                  <input
                    type="radio"
                    name="copies"
                    checked={copies === opt.value}
                    onChange={() => setCopies(opt.value)}
                    className="accent-primary"
                  />
                  <div>
                    <p className="text-xs font-medium">{opt.label}</p>
                    <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Output format */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <FileText className="h-3.5 w-3.5 text-primary" />
              出力形式
            </label>
            <div className="space-y-1.5">
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-all",
                  includeSeparate ? "border-primary/40 bg-primary/[0.06]" : "border-border/30 hover:border-border/60"
                )}
              >
                <input
                  type="checkbox"
                  checked={includeSeparate}
                  onChange={(e) => setIncludeSeparate(e.target.checked)}
                  className="h-3.5 w-3.5 accent-primary"
                />
                <div>
                  <p className="text-xs font-medium">個別PDF（書類ごとに分離）</p>
                  <p className="text-[10px] text-muted-foreground">個別契約書 + 派遣先台帳 + 派遣元台帳 を別々のファイルで</p>
                </div>
              </label>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-all",
                  includeAllInOne ? "border-primary/40 bg-primary/[0.06]" : "border-border/30 hover:border-border/60"
                )}
              >
                <input
                  type="checkbox"
                  checked={includeAllInOne}
                  onChange={(e) => setIncludeAllInOne(e.target.checked)}
                  className="h-3.5 w-3.5 accent-primary"
                />
                <div>
                  <p className="text-xs font-medium">全書類PDF（1つにまとめる）</p>
                  <p className="text-[10px] text-muted-foreground">全書類を1つのPDFに結合 — そのまま印刷可能</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border/40 px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
          >
            キャンセル
          </button>
          <button
            onClick={() => onGenerate({ kobetsuCopies: copies, includeSeparate, includeAllInOne })}
            disabled={!includeSeparate && !includeAllInOne}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40"
          >
            <Package className="h-3.5 w-3.5" />
            SET生成
          </button>
        </div>
      </motion.div>
    </div>
  );
}
