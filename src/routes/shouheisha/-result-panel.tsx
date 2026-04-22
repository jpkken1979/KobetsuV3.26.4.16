import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export type GeneratedArtifact = {
  label: string;
  filename: string;
  path: string;
};

export type GenerationResult = {
  employees: { fullName: string }[];
  contract: { contractNumber: string | null } | null;
  mode: "bundle" | "laborOnly";
  artifacts: GeneratedArtifact[];
  zipFilename: string | null;
  warnings: string[];
};

interface ResultPanelProps {
  result: GenerationResult | null;
}

export function ResultPanel({ result }: ResultPanelProps) {
  const navigate = useNavigate();

  return (
    <>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">生成結果</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          ボタンを押すと、ここにダウンロードリンクが出ます。
        </p>
      </div>

      {!result ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
          まだ生成されていません。
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/30 px-4 py-3 text-sm">
            <div className="font-medium text-foreground">
              {result.employees.length === 1
                ? result.employees[0].fullName
                : `${result.employees.length}名: ${result.employees.map((e) => e.fullName).join(", ")}`}
            </div>
            <div className="mt-1 text-muted-foreground">
              {result.mode === "bundle" && result.contract
                ? `契約番号: ${result.contract.contractNumber ?? "未発行"}`
                : "労働契約書のみ生成しました"}
            </div>
          </div>
          <div className="grid gap-2">
            {result.artifacts.map((artifact) => (
              <a
                key={`${artifact.label}-${artifact.filename}`}
                href={artifact.path}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-md border border-border/60 px-4 py-3 text-sm transition-colors hover:bg-muted/40"
              >
                <span>{artifact.label}</span>
                <span className="text-xs text-muted-foreground">{artifact.filename}</span>
              </a>
            ))}
          </div>
          {result.zipFilename && (
            <div className="rounded-md border border-[color-mix(in_srgb,var(--color-status-ok)_25%,transparent)] bg-[var(--color-status-ok-muted)] px-4 py-3 text-sm text-[var(--color-status-ok)]">
              ZIPでまとめて保存しました: <span className="font-medium">{result.zipFilename}</span>
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => navigate({ to: "/documents" })}>
              書類生成へ
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => navigate({ to: "/contracts" })}>
              契約一覧へ
            </Button>
          </div>
        </div>
      )}
    </>
  );
}