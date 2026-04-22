import { useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } },
};

export function shouheishaCardVariants() {
  return cardVariants;
}

export function shouheishaMotionEnabled() {
  return !useReducedMotion();
}