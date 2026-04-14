import { Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Factory } from "@/lib/api";
import type { RefObject } from "react";
import { EditableCell } from "./-editable-cell";
import {
  COLUMNS,
  COLUMN_GROUPS,
  STICKY_WIDTH,
  TOTAL_SCROLL_WIDTH,
} from "./-table-config";

export interface CompanyTableRowData {
  factory: Factory;
  companyName: string;
  color: string;
  isNewCompany: boolean;
  isEvenWithin: boolean;
}

interface CompanyTableGridProps {
  isLoading: boolean;
  isFullscreen: boolean;
  rowData: CompanyTableRowData[];
  scrollRef: RefObject<HTMLDivElement | null>;
}

function GroupHeaderRow() {
  const groups: { group: string; span: number; width: number }[] = [];
  let currentGroup = "";
  for (let index = 2; index < COLUMNS.length; index += 1) {
    const column = COLUMNS[index];
    if (column.group !== currentGroup) {
      groups.push({ group: column.group, span: 1, width: column.width });
      currentGroup = column.group;
    } else {
      groups[groups.length - 1].span += 1;
      groups[groups.length - 1].width += column.width;
    }
  }

  return (
    <div className="sticky top-0 z-40 flex border-b-2 border-primary/20">
      <div
        className="sticky left-0 z-30 flex shrink-0 items-center border-r border-primary/20 bg-muted/60 backdrop-blur-md"
        style={{ width: STICKY_WIDTH }}
      >
        <span className="px-4 text-[10px] font-bold tracking-widest text-primary/80">
          基本情報
        </span>
      </div>
      <div className="flex">
        {groups.map((group, index) => {
          const config = COLUMN_GROUPS[group.group];
          if (group.group === "basic") {
            return (
              <div
                key={index}
                style={{ width: group.width }}
                className="flex items-center border-r border-primary/10 bg-muted/30 py-2"
              />
            );
          }

          return (
            <div
              key={index}
              style={{ width: group.width }}
              className={cn(
                "flex items-center justify-center border-r border-border/30 py-2 text-[10px] font-bold tracking-wider",
                config?.headerBg ?? "bg-muted/10",
                "text-foreground/60",
              )}
            >
              {config?.label ?? group.group}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CompanyTableGrid({
  isLoading,
  isFullscreen,
  rowData,
  scrollRef,
}: CompanyTableGridProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-8 shadow-[var(--shadow-card)]">
        <div className="flex flex-col items-center gap-3">
          <div className="skeleton h-6 w-48 rounded" />
          <div className="skeleton h-4 w-64 rounded" />
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="skeleton h-8 w-full rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (rowData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/40 bg-card/30 py-24">
        <Table2 className="h-10 w-10 text-muted-foreground/20" />
        <p className="mt-4 text-base font-bold text-muted-foreground">データが見つかりません</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/40 bg-card shadow-[var(--shadow-md)]">
      <div ref={scrollRef} className="overflow-x-auto">
        <div
          role="grid"
          aria-label="工場データ一覧"
          aria-rowcount={rowData.length + 1}
          style={{ minWidth: STICKY_WIDTH + TOTAL_SCROLL_WIDTH }}
        >
          <GroupHeaderRow />

          <div role="row" aria-rowindex={1} className="sticky top-[33px] z-30 flex border-b border-border/40 bg-muted/30">
            <div
              className="sticky left-0 z-30 flex shrink-0 border-r border-primary/10 bg-muted/30 backdrop-blur-md"
              style={{ width: STICKY_WIDTH }}
            >
              <div
                role="columnheader"
                aria-sort="none"
                style={{ width: 200, minWidth: 200 }}
                className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 border-b border-border"
              >
                会社名
              </div>
              <div
                role="columnheader"
                aria-sort="none"
                style={{ width: 160, minWidth: 160 }}
                className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 border-b border-border"
              >
                工場名
              </div>
            </div>

            <div className="flex">
              {COLUMNS.slice(2).map((column) => {
                const groupConfig = COLUMN_GROUPS[column.group];
                return (
                  <div
                    key={column.key}
                    role="columnheader"
                    aria-sort="none"
                    data-group={column.group}
                    data-col={column.key}
                    style={{ width: column.width, minWidth: column.width }}
                    className={cn(
                      "border-r border-border/30 px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider last:border-r-0 border-b border-border/50",
                      groupConfig?.headerBg ?? "",
                      "text-muted-foreground",
                    )}
                  >
                    {column.label}
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className={
              isFullscreen
                ? "max-h-[calc(100vh-270px)] overflow-y-auto bg-background"
                : "max-h-[calc(100vh-350px)] overflow-y-auto bg-background"
            }
          >
            {rowData.map((row, index) => (
              <div
                key={row.factory.id}
                role="row"
                aria-rowindex={index + 2}
                className={cn(
                  "flex transition-colors hover:bg-primary/5",
                  row.isNewCompany ? "border-t-2" : "border-b border-border/50",
                )}
                style={{
                  ...(row.isNewCompany ? { borderTopColor: `${row.color}40` } : {}),
                  backgroundColor: row.isEvenWithin ? `${row.color}06` : `${row.color}0c`,
                }}
              >
                <div
                  className="sticky left-0 z-20 flex shrink-0 border-r border-border/30 backdrop-blur-md"
                  style={{
                    width: STICKY_WIDTH,
                    borderLeft: `3px solid ${row.color}90`,
                    backgroundColor: row.isEvenWithin ? `${row.color}0a` : `${row.color}12`,
                  }}
                >
                  <EditableCell
                    value={row.companyName}
                    factoryId={row.factory.id}
                    fieldKey="companyName"
                    width={200}
                    nameColor={row.color}
                  />
                  <EditableCell
                    value={row.factory.factoryName ?? ""}
                    factoryId={row.factory.id}
                    fieldKey="factoryName"
                    width={160}
                  />
                </div>

                <div className="flex">
                  {COLUMNS.slice(2).map((column) => (
                    <EditableCell
                      key={column.key}
                      value={column.getter(row.factory)}
                      factoryId={row.factory.id}
                      fieldKey={column.key}
                      width={column.width}
                      type={column.type}
                      readOnly={column.readOnly}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
