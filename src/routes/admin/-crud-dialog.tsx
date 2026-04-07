/**
 * Generic CRUD dialog component for the Admin Database Panel.
 * Phase 2 of the Admin Database Panel.
 *
 * Renders a create / edit / or delete confirmation dialog for any table,
 * generating form fields dynamically from AdminColumnMeta.
 *
 * - create: empty form with all editable columns
 * - edit:   pre-filled form with current row data
 * - delete: ConfirmDialog with warning text
 */

import { useState, useMemo, type ReactNode } from "react";
import { z } from "zod";
import { Dialog, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCreateRow, useUpdateRow, useDeleteRow } from "@/lib/hooks/use-admin-crud";
import type { AdminColumnMeta } from "@/lib/api-types";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CrudDialogProps {
  mode: "create" | "edit" | "delete";
  table: string;
  columns: AdminColumnMeta[];
  row?: Record<string, unknown>;
  onSuccess: () => void;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns a Zod schema built from the table's AdminColumnMeta columns.
 * Excludes primary-key and foreign-key columns on create (id is auto-generated).
 */
function buildSchema(columns: AdminColumnMeta[], mode: "create" | "edit"): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const col of columns) {
    // Skip primary key on create; always skip on edit
    if (col.isPrimaryKey && mode === "create") continue;

    let fieldSchema: z.ZodTypeAny;

    switch (col.type) {
      case "integer":
        fieldSchema = z.string().optional().transform((v) => (v === "" || v == null ? undefined : Number(v)));
        break;
      case "real":
        fieldSchema = z.string().optional().transform((v) => (v === "" || v == null ? undefined : parseFloat(v)));
        break;
      case "boolean":
        // Boolean columns come as 0/1 from SQLite
        fieldSchema = z.union([z.boolean(), z.number()]).optional();
        break;
      case "text":
      default:
        fieldSchema = col.nullable
          ? z.string().optional()
          : z.string().min(1, "Este campo es obligatorio");
        break;
    }

    shape[col.name] = fieldSchema;
  }

  return z.object(shape);
}

/** Derive initial form values from a row or empty strings for create. */
function buildInitialValues(
  columns: AdminColumnMeta[],
  row?: Record<string, unknown>,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const col of columns) {
    if (col.isPrimaryKey && row == null) continue;

    if (row != null) {
      values[col.name] = row[col.name] ?? "";
    } else {
      values[col.name] = col.nullable ? "" : "";
    }
  }

  return values;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CrudDialog({ mode, table, columns, row, onSuccess, onClose }: CrudDialogProps) {
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    buildInitialValues(columns, row),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  // Stable schemas — rebuild only when columns or mode change (delete has no schema)
  const schema = useMemo(
    () => (mode !== "delete" ? buildSchema(columns, mode) : z.object({})),
    [columns, mode],
  );

  // Mutations
  const createRow = useCreateRow(table);
  const updateRow = useUpdateRow(table);
  const deleteRow = useDeleteRow(table);

  const isPending = createRow.isPending || updateRow.isPending || deleteRow.isPending;

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleChange(name: string, rawValue: unknown) {
    setValues((prev) => ({ ...prev, [name]: rawValue }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Strip empty strings for optional text fields to send null
    const cleaned: Record<string, unknown> = {};
    for (const col of columns) {
      if (col.isPrimaryKey) continue;
      const val = values[col.name];
      if (val === "" && col.nullable) {
        cleaned[col.name] = null;
      } else {
        cleaned[col.name] = val;
      }
    }

    const result = schema.safeParse(cleaned);
    if (!result.success) {
      const errors: Record<string, string | undefined> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join(".");
        errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    if (mode === "create") {
      createRow.mutate(result.data, {
        onSuccess: () => {
          onSuccess();
          onClose();
        },
      });
    } else if (mode === "edit" && row?.id != null) {
      updateRow.mutate({ id: row.id as number, data: result.data }, {
        onSuccess: () => {
          onSuccess();
          onClose();
        },
      });
    }
  }

  function handleDeleteConfirm() {
    if (row?.id == null) return;
    deleteRow.mutate(row.id as number, {
      onSuccess: () => {
        onSuccess();
        onClose();
      },
    });
  }

  // ── Column → input rendering ─────────────────────────────────────────────

  function renderField(col: AdminColumnMeta): ReactNode {
    const value = values[col.name] ?? "";

    if (col.type === "boolean") {
      const boolVal = Boolean(value);
      return (
        <label key={col.name} className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={boolVal}
            onChange={(e) => handleChange(col.name, e.target.checked ? 1 : 0)}
            className="h-4 w-4 rounded border-border bg-card accent-primary"
          />
          <span className="text-sm">{col.nullable ? "Sí / No" : col.name}</span>
        </label>
      );
    }

    if (col.type === "integer" || col.type === "real") {
      return (
        <div key={col.name} className="flex flex-col gap-1.5">
          <label htmlFor={col.name} className="text-sm font-medium">
            {col.name}
            {col.nullable && <span className="ml-1 text-xs text-muted-foreground">(opcional)</span>}
          </label>
          <Input
            id={col.name}
            type="number"
            step={col.type === "real" ? "any" : "1"}
            value={String(value)}
            onChange={(e) => handleChange(col.name, e.target.value)}
            placeholder={`Ingrese ${col.name}`}
            error={fieldErrors[col.name]}
            disabled={isPending}
          />
          {fieldErrors[col.name] && (
            <p className="text-xs text-destructive">{fieldErrors[col.name]}</p>
          )}
        </div>
      );
    }

    // text
    return (
      <div key={col.name} className="flex flex-col gap-1.5">
        <label htmlFor={col.name} className="text-sm font-medium">
          {col.name}
          {col.nullable && <span className="ml-1 text-xs text-muted-foreground">(opcional)</span>}
        </label>
        <Input
          id={col.name}
          type="text"
          value={String(value)}
          onChange={(e) => handleChange(col.name, e.target.value)}
          placeholder={`Ingrese ${col.name}`}
          error={fieldErrors[col.name]}
          disabled={isPending}
        />
        {fieldErrors[col.name] && (
          <p className="text-xs text-destructive">{fieldErrors[col.name]}</p>
        )}
      </div>
    );
  }

  // ── Render by mode ───────────────────────────────────────────────────────

  if (mode === "delete") {
    const displayId = row?.id ?? "?";
    const preview = row
      ? Object.entries(row)
          .slice(0, 4)
          .map(([k, v]) => `${k}=${v}`)
          .join(" | ")
      : "";

    return (
      <ConfirmDialog
        open
        onClose={onClose}
        onConfirm={handleDeleteConfirm}
        title={`Eliminar registro`}
        description={`¿Está seguro de eliminar el registro con id=${displayId} de "${table}"? Esta acción es irreversible.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="destructive"
        isPending={isPending}
        extraContent={
          preview ? (
            <p className="text-xs font-mono text-muted-foreground break-all">{preview}</p>
          ) : undefined
        }
      />
    );
  }

  // create / edit
  const title = mode === "create" ? `Crear ${table}` : `Editar ${table}`;
  const editableColumns = columns.filter((col) => !col.isPrimaryKey);

  return (
    <Dialog open onClose={onClose} className="max-w-lg">
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <div className="flex-1">
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogClose onClose={onClose} />
        </DialogHeader>

        <div className="flex flex-col gap-4 mb-6">
          {editableColumns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay columnas editables.</p>
          ) : (
            editableColumns.map(renderField)
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" variant={mode === "create" ? "default" : "cyan"} loading={isPending}>
            {mode === "create" ? "Crear" : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
