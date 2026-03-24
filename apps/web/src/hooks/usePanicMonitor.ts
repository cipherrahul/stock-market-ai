import { useState, useEffect, useRef } from 'react';

/**
 * 2026 EMOTION-AWARE UX HOOK
 * Detects 'Panic' behavior via mouse telemetry and click frequency.
 * Returns true if the user seems to be in a panic state.
 */
export function usePanicMonitor() {
  const [isPanicking, setIsPanicking] = useState(false);
  const velocityRef = useRef(0);
  const clickCountRef = useRef(0);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const lastTimeRef = useRef(Date.now());

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      const dt = now - lastTimeRef.current;
      if (dt <= 0) return;

      const dx = e.clientX - lastPosRef.current.x;
      const dy = e.clientY - lastPosRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      const velocity = dist / dt;
      velocityRef.current = velocity;

      // Detect "Jitter" or rapid erratic movement
      if (velocity > 5) { // Threshold for erratic movement
        checkPanic();
      }

      lastPosRef.current = { x: e.clientX, y: e.clientY };
      lastTimeRef.current = now;
    };

    const handleClick = () => {
      clickCountRef.current += 1;
      setTimeout(() => {
        clickCountRef.current -= 1;
      }, 2000); // 2 second window

      if (clickCountRef.current > 7) { // Rapid clicking
        checkPanic();
      }
    };

    const checkPanic = () => {
        // Only trigger panic if velocity or clicks are high
        if (velocityRef.current > 7 || clickCountRef.current > 8) {
            setIsPanicking(true);
            // Auto-reset panic after 10 seconds of calm
            setTimeout(() => setIsPanicking(false), 10000);
        }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
    };
  }, []);

  return { isPanicking, resetPanic: () => setIsPanicking(false) };
}
