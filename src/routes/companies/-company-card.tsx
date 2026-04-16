import { useState } from "react";
import { ChevronDown, ChevronRight, Building2, Edit3, Plus, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useFactoryBadges } from "@/lib/hooks/use-factories";
import type { Company } from "@/lib/api-types";
import type { FactoryBadgeStatus } from "@/lib/hooks/use-factories";

interface Props {
  company: Company;
  onEdit: (company: Company) => void;
  onAddFactory: (company: Company) => void;
  onEditFactory: (factoryId: number) => void;
  onYearlyConfig?: (company: Company) => void;
}

export function CompanyCard({ company, onEdit, onAddFactory, onEditFactory, onYearlyConfig }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { data: badges } = useFactoryBadges(company.id);
  const badgeMap = new Map((badges ?? []).map((b: FactoryBadgeStatus) => [b.factoryId, b]));

  const dataCompleteLabel = (status: FactoryBadgeStatus["dataComplete"]) => {
    if (status === "ok") return "入力済";
    if (status === "warning") return "要確認";
    return "不足";
  };

  return (
    <Card className="p-4">
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium flex-1">{company.name}</span>
        {company.nameKana && (
          <span className="text-xs text-muted-foreground">{company.nameKana}</span>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(company);
          }}
        >
          <Edit3 className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onAddFactory(company);
          }}
        >
          <Plus className="h-3 w-3" />
        </Button>
        {onYearlyConfig && (
          <Button
            size="sm"
            variant="ghost"
            title="企業年度別設定"
            onClick={(e) => {
              e.stopPropagation();
              onYearlyConfig(company);
            }}
          >
            <CalendarDays className="h-3 w-3" />
          </Button>
        )}
      </div>

      {expanded && company.factories && (
        <div className="mt-3 pl-8 space-y-2">
          {company.factories.map((factory) => {
            const badge = badgeMap.get(factory.id);
            const hasAssignedEmployees = (badge?.employeeCount ?? 0) > 0;
            return (
              <div key={factory.id} className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                <span className="flex-1">{factory.factoryName}</span>
                {factory.department && (
                  <span className="text-xs text-muted-foreground">
                    {factory.department}
                  </span>
                )}
                {badge && (
                  <>
                    {hasAssignedEmployees ? (
                      <>
                        <Badge
                          variant={
                            badge.dataComplete === "ok"
                              ? "default"
                              : badge.dataComplete === "warning"
                                ? "secondary"
                                : "destructive"
                          }
                          className="text-xs"
                        >
                          {dataCompleteLabel(badge.dataComplete)}
                        </Badge>
                        {badge.hasCalendar ? (
                          <Badge variant="outline" className="text-xs">
                            cal
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            カレンダー未設定
                          </Badge>
                        )}
                      </>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        未配属
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {badge.employeeCount}人
                    </span>
                  </>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEditFactory(factory.id)}
                >
                  <Edit3 className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
