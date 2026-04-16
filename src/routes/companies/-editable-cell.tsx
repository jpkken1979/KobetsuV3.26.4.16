import { useEffect, useRef, useState } from "react";
import { useUpdateFactory } from "@/lib/hooks/use-factories";
import { cn } from "@/lib/utils";
import type { CompanyTableCellType } from "./-table-config";

interface EditableCellProps {
  value: string;
  factoryId: number;
  fieldKey: string;
  width: number;
  type?: CompanyTableCellType;
  nameColor?: string;
  readOnly?: boolean;
}

export function EditableCell({
  value,
  factoryId,
  fieldKey,
  width,
  type = "text",
  nameColor,
  readOnly,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateFactory = useUpdateFactory();

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setTempValue(value);
  }, [value]);

  const handleSave = () => {
    setIsEditing(false);
    if (tempValue === value) {
      return;
    }

    const payload: Record<string, string | number | null> = {};
    if (type === "number") {
      const numberValue = Number.parseFloat(tempValue);
      payload[fieldKey] = Number.isNaN(numberValue) ? null : numberValue;
    } else {
      payload[fieldKey] = tempValue || null;
    }

    updateFactory.mutate({ id: factoryId, data: payload });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      handleSave();
    }
    if (event.key === "Escape") {
      setTempValue(value);
      setIsEditing(false);
    }
    if (event.key === "Tab") {
      event.preventDefault();
      handleSave();
    }
  };

  if (fieldKey === "companyName") {
    return (
      <div
        role="gridcell"
        style={{ width, minWidth: width, ...(nameColor ? { color: nameColor } : {}) }}
        className={cn("truncate px-3 py-2.5 text-xs font-bold", !nameColor && "text-primary/80")}
        title={value}
      >
        {value || <span className="text-muted-foreground/30">--</span>}
      </div>
    );
  }

  if (readOnly) {
    return (
      <div
        role="gridcell"
        style={{ width, minWidth: width }}
        className="truncate px-3 py-2.5 text-xs text-foreground/90 dark:text-white/60"
        title={value}
      >
        {value || <span className="text-muted-foreground/30">--</span>}
      </div>
    );
  }

  if (type === "number" && !isEditing) {
    return (
      <div
        role="gridcell"
        style={{ width, minWidth: width }}
        className="cursor-pointer truncate px-3 py-2.5 font-mono text-xs text-primary transition-colors hover:bg-primary/[0.04] hover:text-primary/80"
        onClick={() => setIsEditing(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsEditing(true);
          }
        }}
        tabIndex={0}
        aria-label={`${fieldKey}を編集`}
        title={value}
      >
        {value || <span className="text-muted-foreground/30">--</span>}
      </div>
    );
  }

  if (isEditing) {
    return (
      <div role="gridcell" style={{ width, minWidth: width }} className="px-0.5">
        <input
          ref={inputRef}
          type={type === "date" ? "date" : type === "number" ? "number" : "text"}
          className="w-full rounded border border-primary/40 bg-background px-1.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-primary/50 dark:bg-primary/5"
          value={tempValue}
          onChange={(event) => setTempValue(event.target.value)}
          onBlur={handleSave}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setTempValue(value);
              setIsEditing(false);
              return;
            }
            handleKeyDown(event);
          }}
        />
      </div>
    );
  }

  return (
    <div
      role="gridcell"
      style={{ width, minWidth: width }}
      className="cursor-pointer truncate px-3 py-2.5 text-xs text-foreground/90 transition-colors hover:bg-primary/[0.04] hover:text-foreground dark:text-white/60 dark:hover:text-white/80"
      onClick={() => setIsEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setIsEditing(true);
        }
      }}
      tabIndex={0}
      aria-label={`${fieldKey}を編集`}
      title={value}
    >
      {value || <span className="text-muted-foreground/30">--</span>}
    </div>
  );
}
