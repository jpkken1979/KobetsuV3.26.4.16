import { useState, useCallback } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { CommandPalette } from "./command-palette";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouterState } from "@tanstack/react-router";

export type LayoutAlign = "left" | "center" | "right";

const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

const pageTransition = {
  duration: 0.2,
  ease: [0.16, 1, 0.3, 1] as [number, number, number, number], // ease-out-expo
};

const ALIGN_CLASSES: Record<LayoutAlign, string> = {
  left: "max-w-none p-4 md:p-6",
  center: "max-w-[1400px] mx-auto p-4 md:p-8",
  right: "max-w-[1400px] ml-auto p-4 md:p-8",
};

export function RootLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [layoutAlign, setLayoutAlign] = useState<LayoutAlign>(() => {
    if (typeof window === "undefined") return "left";
    return (localStorage.getItem("layout-align") as LayoutAlign) || "left";
  });
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const shouldReduceMotion = useReducedMotion();

  const handleAlignChange = useCallback((align: LayoutAlign) => {
    setLayoutAlign(align);
    localStorage.setItem("layout-align", align);
  }, []);

  // Table page always uses full width with tight padding
  const isTablePage = pathname.includes("/table");
  const contentClasses = isTablePage
    ? "max-w-none px-3 md:px-4"
    : ALIGN_CLASSES[layoutAlign];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Background effects — rendered via CSS classes, visible only in dark mode */}
      <div aria-hidden="true" className="pointer-events-none">
        <div className="bg-grid" />
        <div
          className="bg-orb"
          style={{
            width: 600,
            height: 600,
            background: "radial-gradient(circle, rgba(139,92,246,0.25), transparent)",
            top: -200,
            left: -100,
            animationDelay: "0s",
          }}
        />
        <div
          className="bg-orb"
          style={{
            width: 500,
            height: 500,
            background: "radial-gradient(circle, rgba(0,245,212,0.18), transparent)",
            top: "30vh",
            right: -150,
            animationDelay: "-3s",
          }}
        />
        <div
          className="bg-orb"
          style={{
            width: 400,
            height: 400,
            background: "radial-gradient(circle, rgba(251,191,36,0.12), transparent)",
            bottom: -100,
            left: "35%",
            animationDelay: "-5s",
          }}
        />
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
        className={`fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          layoutAlign={layoutAlign}
          onAlignChange={handleAlignChange}
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
