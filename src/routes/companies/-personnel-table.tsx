import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { INPUT_SM_CLS, type FormValue, type PersonnelRole, CLIENT_ROLES, UNS_ROLES } from "./-shared";

interface PersonnelTableProps {
  form: Record<string, FormValue>;
  onChange: (key: string, value: string | null) => void;
}

function RoleRow({
  role,
  form,
  onChange,
  isEditing,
  onStartEdit,
  onStopEdit,
}: {
  role: PersonnelRole;
  form: Record<string, FormValue>;
  onChange: (key: string, value: string | null) => void;
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const name = String(form[role.nameKey] ?? "");
  const dept = String(form[role.deptKey] ?? "");
  const phone = String(form[role.phoneKey] ?? "");
  const hasData = Boolean(name || dept || phone);

  // Click-outside detection
  useEffect(() => {
    if (!isEditing) return;

    function handleMouseDown(e: MouseEvent) {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
        onStopEdit();
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isEditing, onStopEdit]);

  // Autofocus first input on edit
  useEffect(() => {
    if (isEditing && nameRef.current) {
      nameRef.current.focus();
    }
  }, [isEditing]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onStopEdit();
    }
  }

  if (isEditing) {
    return (
      <div
        ref={rowRef}
        className="grid grid-cols-[110px_1fr_1fr_130px] items-center gap-2 rounded-lg border border-primary/30 bg-primary/[0.02] px-3 py-2"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2">
          <div className={cn("h-1.5 w-1.5 shrink-0 rounded-full", hasData ? "bg-primary" : "bg-muted-foreground/20")} />
          <span className="text-xs font-medium text-foreground">{role.label}</span>
        </div>
        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={(e) => onChange(role.nameKey, e.target.value || null)}
          placeholder="氏名"
          className={INPUT_SM_CLS}
        />
        <input
          type="text"
          value={dept}
          onChange={(e) => onChange(role.deptKey, e.target.value || null)}
          placeholder="部署"
          className={INPUT_SM_CLS}
        />
        <input
          type="text"
          value={phone}
          onChange={(e) => onChange(role.phoneKey, e.target.value || null)}
          placeholder="電話番号"
          className={INPUT_SM_CLS}
        />
      </div>
    );
  }

  return (
    <div
      ref={rowRef}
      className="grid cursor-pointer grid-cols-[110px_1fr_1fr_130px] items-center gap-2 rounded-lg px-3 py-1.5 transition-colors hover:bg-muted/50"
      onClick={onStartEdit}
    >
      <div className="flex items-center gap-2">
        <div className={cn("h-1.5 w-1.5 shrink-0 rounded-full", hasData ? "bg-primary" : "bg-muted-foreground/20")} />
        <span className="text-xs font-medium text-foreground">{role.label}</span>
      </div>
      <span className={cn("truncate text-xs", name ? "text-foreground" : "text-muted-foreground/50")}>
        {name || "未設定"}
      </span>
      <span className={cn("truncate text-xs", dept ? "text-foreground" : "text-muted-foreground/50")}>
        {dept || "—"}
      </span>
      <span className={cn("truncate text-xs", phone ? "text-foreground" : "text-muted-foreground/50")}>
        {phone || "—"}
      </span>
    </div>
  );
}

function RoleGroup({
  label,
  roles,
  form,
  onChange,
  editingRole,
  onEditRole,
  onStopEdit,
}: {
  label: string;
  roles: PersonnelRole[];
  form: Record<string, FormValue>;
  onChange: (key: string, value: string | null) => void;
  editingRole: string | null;
  onEditRole: (key: string) => void;
  onStopEdit: () => void;
}) {
  return (
    <div className="space-y-1">
      <div className="px-3 text-[9px] font-bold uppercase tracking-[1.5px] text-muted-foreground">
        {label}
      </div>

      {/* Header */}
      <div className="grid grid-cols-[110px_1fr_1fr_130px] gap-2 px-3 pb-0.5">
        <span className="text-[10px] font-medium text-muted-foreground/60">役職</span>
        <span className="text-[10px] font-medium text-muted-foreground/60">氏名</span>
        <span className="text-[10px] font-medium text-muted-foreground/60">部署</span>
        <span className="text-[10px] font-medium text-muted-foreground/60">電話番号</span>
      </div>

      {/* Rows */}
      {roles.map((role) => (
        <RoleRow
          key={role.nameKey}
          role={role}
          form={form}
          onChange={onChange}
          isEditing={editingRole === role.nameKey}
          onStartEdit={() => onEditRole(role.nameKey)}
          onStopEdit={onStopEdit}
        />
      ))}
    </div>
  );
}

export function PersonnelTable({ form, onChange }: PersonnelTableProps) {
  const [editingRole, setEditingRole] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <RoleGroup
        label="派遣先（客先側）"
        roles={CLIENT_ROLES}
        form={form}
        onChange={onChange}
        editingRole={editingRole}
        onEditRole={setEditingRole}
        onStopEdit={() => setEditingRole(null)}
      />
      <RoleGroup
        label="派遣元（UNS側）"
        roles={UNS_ROLES}
        form={form}
        onChange={onChange}
        editingRole={editingRole}
        onEditRole={setEditingRole}
        onStopEdit={() => setEditingRole(null)}
      />
    </div>
  );
}
