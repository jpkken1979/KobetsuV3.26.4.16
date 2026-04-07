import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
    ArrowRight,
    Building2,
    FileOutput,
    FileText,
    History,
    LayoutDashboard,
    Plus,
    Search,
    Settings,
    Shield,
    Upload,
    Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ElementType;
  action: () => void;
  keywords: string[];
  group: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const commands: CommandItem[] = [
    {
      id: "new-contract",
      label: "新規契約作成",
      sublabel: "Ctrl+N",
      icon: Plus,
      action: () => navigate({ to: "/contracts/new" }),
      keywords: ["新規", "契約", "作成", "new", "contract", "create"],
      group: "ACTION",
    },
    {
      id: "dashboard",
      label: "ダッシュボード",
      sublabel: "OVERVIEW",
      icon: LayoutDashboard,
      action: () => navigate({ to: "/" }),
      keywords: ["ダッシュボード", "dashboard", "home", "top"],
      group: "MAIN",
    },
    {
      id: "contracts",
      label: "個別契約書一覧",
      sublabel: "CONTRACT_REGISTRY",
      icon: FileText,
      action: () => navigate({ to: "/contracts" }),
      keywords: ["契約", "個別", "一覧", "contract", "list", "kobetsu"],
      group: "MAIN",
    },
    {
      id: "employees",
      label: "派遣社員",
      sublabel: "EMPLOYEE_REGISTRY",
      icon: Users,
      action: () => navigate({ to: "/employees" }),
      keywords: ["社員", "派遣", "employee", "worker", "staff"],
      group: "MASTER",
    },
    {
      id: "companies",
      label: "派遣先企業",
      sublabel: "COMPANY_REGISTRY",
      icon: Building2,
      action: () => navigate({ to: "/companies" }),
      keywords: ["企業", "派遣先", "company", "client"],
      group: "MASTER",
    },
    {
      id: "documents",
      label: "書類生成",
      sublabel: "DOCUMENT_GENERATOR",
      icon: FileOutput,
      action: () => navigate({ to: "/documents" }),
      keywords: ["書類", "生成", "PDF", "document", "generate"],
      group: "MASTER",
    },
    {
      id: "history",
      label: "履歴",
      sublabel: "ACTIVITY_HISTORY",
      icon: History,
      action: () => navigate({ to: "/history" }),
      keywords: ["履歴", "history", "past"],
      group: "MASTER",
    },
    {
      id: "import",
      label: "データインポート",
      sublabel: "DATA_IMPORT",
      icon: Upload,
      action: () => navigate({ to: "/import" }),
      keywords: ["取込", "インポート", "import", "data", "excel"],
      group: "SYSTEM",
    },
    {
      id: "audit",
      label: "監査ログ",
      sublabel: "AUDIT_LOG",
      icon: Shield,
      action: () => navigate({ to: "/audit" }),
      keywords: ["監査", "ログ", "audit", "log"],
      group: "SYSTEM",
    },
    {
      id: "settings",
      label: "設定",
      sublabel: "SYSTEM_SETTINGS",
      icon: Settings,
      action: () => navigate({ to: "/settings" }),
      keywords: ["設定", "settings", "config"],
      group: "SYSTEM",
    },
  ];

  const filtered = query
    ? commands.filter((cmd) => {
        const q = query.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(q) ||
          cmd.sublabel?.toLowerCase().includes(q) ||
          cmd.keywords.some((k) => k.toLowerCase().includes(q))
        );
      })
    : commands;

  // Group filtered commands
  const grouped = filtered.reduce(
    (acc, cmd) => {
      if (!acc[cmd.group]) acc[cmd.group] = [];
      acc[cmd.group].push(cmd);
      return acc;
    },
    {} as Record<string, CommandItem[]>
  );

  const executeCommand = useCallback(
    (cmd: CommandItem) => {
      cmd.action();
      setOpen(false);
      setQuery("");
    },
    []
  );

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
        setSelectedIndex(0);
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        const active = document.activeElement;
        if (active?.tagName === "INPUT" || active?.tagName === "TEXTAREA") return;
        e.preventDefault();
        navigate({ to: "/contracts/new" });
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  useEffect(() => {
    const openHandler = () => {
      setOpen(true);
      setQuery("");
      setSelectedIndex(0);
    };
    window.addEventListener("command-palette:open", openHandler as EventListener);
    return () => window.removeEventListener("command-palette:open", openHandler as EventListener);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(timer);
    }
    if (!open && previousActiveElementRef.current) {
      previousActiveElementRef.current.focus();
      previousActiveElementRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusableSelectors =
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelectors),
      );

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleFocusTrap);
    return () => document.removeEventListener("keydown", handleFocusTrap);
  }, [open]);

  // Arrow navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        executeCommand(filtered[selectedIndex]);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    },
    [filtered, selectedIndex, executeCommand]
  );

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector('[data-selected="true"]');
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  let flatIndex = -1;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            {...(shouldReduceMotion
              ? {}
              : {
                  initial: { opacity: 0 },
                  animate: { opacity: 1 },
                  exit: { opacity: 0 },
                  transition: { duration: 0.15 },
                })}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[6px]"
            onClick={() => setOpen(false)}
          />

          {/* Palette */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="コマンドパレット"
            aria-describedby="command-palette-footer"
            {...(shouldReduceMotion
              ? {}
              : {
                  initial: { opacity: 0, scale: 0.96, y: -16 },
                  animate: { opacity: 1, scale: 1, y: 0 },
                  exit: { opacity: 0, scale: 0.96, y: -16 },
                  transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
                })}
            className="fixed left-1/2 top-[18%] z-50 w-full max-w-[520px] -translate-x-1/2 overflow-hidden rounded-xl border border-border/60 bg-card shadow-xl"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5">
              <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="コマンドを検索..."
                aria-label="コマンド検索"
                role="combobox"
                aria-expanded="true"
                aria-autocomplete="list"
                aria-controls="command-palette-listbox"
                aria-activedescendant={filtered[selectedIndex] ? `command-option-${filtered[selectedIndex].id}` : undefined}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              />
              <kbd className="rounded-[4px] border border-border/60 bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div id="command-palette-listbox" ref={listRef} role="listbox" className="max-h-[320px] overflow-y-auto p-1.5">
              {filtered.length === 0 ? (
                <div className="px-3 py-10 text-center text-sm text-muted-foreground">
                  該当するコマンドがありません
                </div>
              ) : (
                Object.entries(grouped).map(([group, items]) => (
                  <div key={group}>
                    <p className="px-3 pb-1 pt-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      {`// ${group}`}
                    </p>
                    {items.map((cmd) => {
                      flatIndex++;
                      const isSelected = flatIndex === selectedIndex;
                      const currentIndex = flatIndex;
                      return (
                        <button
                          id={`command-option-${cmd.id}`}
                          key={cmd.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          data-selected={isSelected}
                          onClick={() => executeCommand(cmd)}
                          onMouseEnter={() => setSelectedIndex(currentIndex)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            isSelected
                              ? "bg-primary/8 text-primary"
                              : "text-foreground hover:bg-muted/60"
                          )}
                        >
                          <cmd.icon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              isSelected ? "text-primary" : "text-muted-foreground"
                            )}
                          />
                          <span className="flex-1 text-left">{cmd.label}</span>
                          {cmd.sublabel && (
                            <span className="text-[11px] text-muted-foreground/60">
                              {cmd.sublabel}
                            </span>
                          )}
                          {isSelected && (
                            <ArrowRight className="h-3 w-3 text-primary/60" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div id="command-palette-footer" className="flex items-center justify-between border-t border-border/40 bg-muted/30 px-4 py-2 text-[10px] text-muted-foreground/60">
              <span>
                <kbd className="font-medium">Up/Down</kbd> 移動 &middot;{" "}
                <kbd className="font-medium">Enter</kbd> 実行 &middot;{" "}
                <kbd className="font-medium">Esc</kbd> 閉じる
              </span>
              <span>
                <kbd className="font-medium">Ctrl+N</kbd> 新規契約
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
