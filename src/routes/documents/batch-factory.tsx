import { createFileRoute } from "@tanstack/react-router"
import { PageHeader } from "@/components/ui/page-header"
import { FactoryGenerator } from "./-factory-generator"

export const Route = createFileRoute("/documents/batch-factory")({
  component: BatchFactoryPage,
})

function BatchFactoryPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="工場一括生成"
        subtitle="工場ラインの全有効契約に対して一括でPDFを生成します"
      />
      <FactoryGenerator />
    </div>
  )
}
