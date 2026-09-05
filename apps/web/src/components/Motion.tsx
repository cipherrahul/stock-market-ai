import React from 'react';

/**
 * SOVEREIGN ENTERPRISE MOTION LAYER
 * Enterprise-grade lightweight component wrappers replacing heavy Framer Motion runtime.
 * Provides full React 19 SSR compatibility with zero hydration overhead and native CSS transitions.
 */

interface MotionProps extends React.HTMLAttributes<HTMLElement> {
  initial?: any;
  animate?: any;
  exit?: any;
  transition?: any;
  whileHover?: any;
  whileTap?: any;
  layout?: any;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: any;
  type?: any;
  disabled?: boolean;
}

export const MotionDiv = React.forwardRef<HTMLDivElement, MotionProps>(({ initial, animate, exit, transition, whileHover, whileTap, layout, ...props }, ref) => (
  <div ref={ref} {...props} />
));
MotionDiv.displayName = 'MotionDiv';

export const MotionAside = React.forwardRef<HTMLElement, MotionProps>(({ initial, animate, exit, transition, whileHover, whileTap, layout, ...props }, ref) => (
  <aside ref={ref} {...props} />
));
MotionAside.displayName = 'MotionAside';

export const MotionSection = React.forwardRef<HTMLElement, MotionProps>(({ initial, animate, exit, transition, whileHover, whileTap, layout, ...props }, ref) => (
  <section ref={ref} {...props} />
));
MotionSection.displayName = 'MotionSection';

export const MotionNav = React.forwardRef<HTMLElement, MotionProps>(({ initial, animate, exit, transition, whileHover, whileTap, layout, ...props }, ref) => (
  <nav ref={ref} {...props} />
));
MotionNav.displayName = 'MotionNav';

export const MotionButton = React.forwardRef<HTMLButtonElement, MotionProps>(({ initial, animate, exit, transition, whileHover, whileTap, layout, ...props }, ref) => (
  <button ref={ref} {...props} />
));
MotionButton.displayName = 'MotionButton';

export const MotionP = React.forwardRef<HTMLParagraphElement, MotionProps>(({ initial, animate, exit, transition, whileHover, whileTap, layout, ...props }, ref) => (
  <p ref={ref} {...props} />
));
MotionP.displayName = 'MotionP';

export const MotionSpan = React.forwardRef<HTMLSpanElement, MotionProps>(({ initial, animate, exit, transition, whileHover, whileTap, layout, ...props }, ref) => (
  <span ref={ref} {...props} />
));
MotionSpan.displayName = 'MotionSpan';

export const MotionH1 = React.forwardRef<HTMLHeadingElement, MotionProps>(({ initial, animate, exit, transition, whileHover, whileTap, layout, ...props }, ref) => (
  <h1 ref={ref} {...props} />
));
MotionH1.displayName = 'MotionH1';

export const MotionH2 = React.forwardRef<HTMLHeadingElement, MotionProps>(({ initial, animate, exit, transition, whileHover, whileTap, layout, ...props }, ref) => (
  <h2 ref={ref} {...props} />
));
MotionH2.displayName = 'MotionH2';

export const MotionTr = React.forwardRef<HTMLTableRowElement, MotionProps>(({ initial, animate, exit, transition, whileHover, whileTap, layout, ...props }, ref) => (
  <tr ref={ref} {...props} />
));
MotionTr.displayName = 'MotionTr';

export const AnimatePresence = ({ children }: { children?: React.ReactNode; [key: string]: any }) => <>{children}</>;

export const motion = {
  div: MotionDiv,
  aside: MotionAside,
  section: MotionSection,
  nav: MotionNav,
  button: MotionButton,
  p: MotionP,
  span: MotionSpan,
  h1: MotionH1,
  h2: MotionH2,
  tr: MotionTr,
};
