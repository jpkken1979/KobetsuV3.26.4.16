import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export type RecruitForm = {
  id: string;
  employeeNumber: string;
  fullName: string;
  katakanaName: string;
  nationality: string;
  gender: string;
  birthDate: string;
  hireDate: string;
  actualHireDate: string;
  postalCode: string;
  address: string;
  visaExpiry: string;
  visaType: string;
};

function fieldClassName() {
  return "mt-1.5";
}

interface RecruitFormCardProps {
  recruit: RecruitForm;
  index: number;
  canDelete: boolean;
  onChange: (index: number, patch: Partial<RecruitForm>) => void;
  onRemove: (index: number) => void;
}

export function RecruitFormCard({ recruit, index, canDelete, onChange, onRemove }: RecruitFormCardProps) {
  const update = (patch: Partial<RecruitForm>) => onChange(index, patch);

  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="info" size="sm">招聘者 #{index + 1}</Badge>
          {recruit.fullName.trim() || recruit.katakanaName.trim() ? (
            <span className="text-sm text-muted-foreground">
              {recruit.fullName.trim() || recruit.katakanaName.trim()}
            </span>
          ) : (
            <span className="text-xs italic text-muted-foreground/60">未入力</span>
          )}
        </div>
        {canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemove(index)}
            className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            削除
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium">社員番号</label>
          <Input
            className={fieldClassName()}
            value={recruit.employeeNumber}
            onChange={(e) => update({ employeeNumber: e.target.value })}
            placeholder="空欄なら SHO<YYMMDD> を自動付番"
          />
        </div>
        <div>
          <label className="text-sm font-medium">氏名</label>
          <Input
            className={fieldClassName()}
            value={recruit.fullName}
            onChange={(e) => update({ fullName: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">カタカナ</label>
          <Input
            className={fieldClassName()}
            value={recruit.katakanaName}
            onChange={(e) => update({ katakanaName: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">国籍</label>
          <Input
            className={fieldClassName()}
            value={recruit.nationality}
            onChange={(e) => update({ nationality: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">性別</label>
          <Select
            className={fieldClassName()}
            value={recruit.gender}
            onChange={(e) => update({ gender: e.target.value })}
          >
            <option value="">未設定</option>
            <option value="male">男性</option>
            <option value="female">女性</option>
            <option value="other">その他</option>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">生年月日</label>
          <Input
            className={fieldClassName()}
            type="date"
            value={recruit.birthDate}
            onChange={(e) => update({ birthDate: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">入社日</label>
          <Input
            className={fieldClassName()}
            type="date"
            value={recruit.hireDate}
            onChange={(e) => update({ hireDate: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">実入社日</label>
          <Input
            className={fieldClassName()}
            type="date"
            value={recruit.actualHireDate}
            onChange={(e) => update({ actualHireDate: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">郵便番号</label>
          <Input
            className={fieldClassName()}
            value={recruit.postalCode}
            onChange={(e) => update({ postalCode: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">住所</label>
          <Input
            className={fieldClassName()}
            value={recruit.address}
            onChange={(e) => update({ address: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">在留期限</label>
          <Input
            className={fieldClassName()}
            type="date"
            value={recruit.visaExpiry}
            onChange={(e) => update({ visaExpiry: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">在留資格</label>
          <Input
            className={fieldClassName()}
            value={recruit.visaType}
            onChange={(e) => update({ visaType: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

interface RecruitFormListProps {
  recruits: RecruitForm[];
  onChange: (index: number, patch: Partial<RecruitForm>) => void;
  onRemove: (index: number) => void;
}

export function RecruitFormList({ recruits, onChange, onRemove }: RecruitFormListProps) {
  return (
    <div className="space-y-4">
      {recruits.map((recruit, index) => (
        <RecruitFormCard
          key={recruit.id}
          recruit={recruit}
          index={index}
          canDelete={recruits.length > 1}
          onChange={onChange}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

export { fieldClassName };