import { useState, useCallback } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { CommandPalette } from "./command-palette";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouterState } from "@tanstack/react-router";
import { useUIPrefs } from "@/stores/ui-prefs";
import { cn } from "@/lib/utils";

export type LayoutMode = "wide" | "balanced" | "focus";

const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

const pageTransition = {
  duration: 0.2,
  ease: [0.16, 1, 0.3, 1] as [number, number, number, number], // ease-out-expo
};

const MODE_CLASSES: Record<LayoutMode, string> = {
  wide: "max-w-none p-4 md:p-6",
  balanced: "max-w-[1480px] mx-auto p-4 md:p-8",
  focus: "max-w-[1220px] mx-auto p-4 md:p-8",
};

export function RootLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => {
    if (typeof window === "undefined") return "wide";
    const stored = localStorage.getItem("layout-mode") as LayoutMode | null;
    if (stored === "wide" || stored === "balanced" || stored === "focus") return stored;
    const legacy = localStorage.getItem("layout-align");
    if (legacy === "center") return "balanced";
    if (legacy === "right") return "focus";
    return "wide";
  });
  const { sidebarCollapsed } = useUIPrefs();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const shouldReduceMotion = useReducedMotion();

  const handleModeChange = useCallback((mode: LayoutMode) => {
    setLayoutMode(mode);
    localStorage.setItem("layout-mode", mode);
  }, []);

  const isTablePage = pathname.includes("/table") || pathname === "/employees/" || pathname === "/data-check/" || pathname === "/contracts/";
  const contentClasses = isTablePage ? "max-w-none px-3 md:px-4" : MODE_CLASSES[layoutMode];

  return (
    <div className="relative flex h-screen overflow-hidden bg-background">
      <div aria-hidden="true" className="pointer-events-none">
        <div className="bg-grid" />
        <div
          className="bg-orb"
          style={{
            width: 680,
            height: 680,
            background: "radial-gradient(circle, rgba(214,31,42,0.18), transparent 70%)",
            top: -220,
            left: -120,
            animationDelay: "0s",
          }}
        />
        <div
          className="bg-orb"
          style={{
            width: 520,
            height: 520,
            background: "radial-gradient(circle, rgba(255,122,24,0.16), transparent 68%)",
            top: "32vh",
            right: -160,
            animationDelay: "-3s",
          }}
        />
        <div
          className="bg-orb"
          style={{
            width: 420,
            height: 420,
            background: "radial-gradient(circle, rgba(245,165,36,0.10), transparent 72%)",
            bottom: -110,
            left: "35%",
            animationDelay: "-5s",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.16),_transparent_35%)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.03),_transparent_35%)]" />
      </div>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
      >
        コンテンツへスキップ
      </a>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            {...(shouldReduceMotion
              ? {}
              : {
                  initial: { opacity: 0 },
                  animate: { opacity: 1 },
                  exit: { opacity: 0 },
                  transition: { duration: 0.2 },
                })}
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar — fixed on desktop, slide-in on mobile */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 transform transition-all duration-300 ease-in-out lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          sidebarCollapsed ? "w-[4.8rem]" : "w-[18rem]",
        )}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          layoutMode={layoutMode}
          onModeChange={handleModeChange}
        />
        <main id="main-content" className="flex-1 overflow-y-auto">
          <div className={contentClasses}>
            {shouldReduceMotion ? (
              children
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={pathname}
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={pageTransition}
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </main>
      </div>

      {/* Command Palette — global */}
      <CommandPalette />
    </div>
  );
}
