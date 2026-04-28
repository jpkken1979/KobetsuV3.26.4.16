import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  className?: string;
  format?: (n: number) => string;
}

export function AnimatedNumber({
  value,
  duration = 1200,
  className,
  format = (n) => n.toLocaleString("ja-JP"),
}: AnimatedNumberProps) {
  const shouldReduceMotion = useReducedMotion();
  const [display, setDisplay] = useState<number>(shouldReduceMotion ? value : 0);
  const previousRef = useRef<number>(0);

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const initial = previousRef.current;
    const target = value;
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(initial + (target - initial) * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        previousRef.current = target;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, shouldReduceMotion]);

  return <span className={className}>{format(display)}</span>;
}
