import { createFileRoute } from "@tanstack/react-router"
import { PageHeader } from "@/components/ui/page-header"
import { IdGenerator } from "./-id-generator"

export const Route = createFileRoute("/documents/batch-ids")({
  component: BatchIdsPage,
})

function BatchIdsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="ID指定一括生成"
        subtitle="派遣先IDまたは派遣元IDを指定して契約書を一括作成・生成します"
      />
      <IdGenerator />
    </div>
  )
}
