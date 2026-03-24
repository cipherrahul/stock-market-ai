import { motion } from 'framer-motion';

/**
 * SOVEREIGN COMPATIBILITY LAYER
 * Resolves IntrinsicAttributes mismatch between Framer Motion v10 and React v19.
 */

export const MotionDiv = motion.div as any;
export const MotionAside = motion.aside as any;
export const MotionSection = motion.section as any;
export const MotionNav = motion.nav as any;
export const MotionButton = motion.button as any;
export const MotionP = motion.p as any;
export const MotionSpan = motion.span as any;
export const MotionH1 = motion.h1 as any;
export const MotionH2 = motion.h2 as any;
export const MotionTr = motion.tr as any;
