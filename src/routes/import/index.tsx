import { Button } from "@/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { ImportPage } from "./-import-page";

export const Route = createFileRoute("/import/")({
  component: ImportPage,
  errorComponent: ({ reset }) => (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <p className="text-lg font-semibold text-destructive">エラーが発生しました</p>
      <Button variant="outline" onClick={reset}>再試行</Button>
    </div>
  ),
});

