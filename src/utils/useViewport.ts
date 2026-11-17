import { useEffect, useRef, useState } from 'react';

export interface ViewportMetrics {
  width: number;
  height: number;
  isMobile: boolean;
  isLandscape: boolean;
  isCompactHeight: boolean;
  isKeyboardOpen: boolean;
  isTouchDevice: boolean;
}

function readMetrics(baselineHeightRef: { current: number }): ViewportMetrics {
  if (typeof window === 'undefined') {
    return {
      width: 1280,
      height: 720,
      isMobile: false,
      isLandscape: true,
      isCompactHeight: false,
      isKeyboardOpen: false,
      isTouchDevice: false,
    };
  }

  const vv = window.visualViewport;
  const width = Math.round(vv ? vv.width : window.innerWidth);
  const height = Math.round(vv ? vv.height : window.innerHeight);

  if (height > baselineHeightRef.current || Math.abs(width - window.innerWidth) > 80) {
    baselineHeightRef.current = Math.max(height, window.innerHeight);
  }

  const activeInput =
    typeof document !== 'undefined' &&
    ['input', 'textarea'].includes(document.activeElement?.tagName.toLowerCase() || '');

  const isKeyboardOpen = Boolean(
    activeInput && vv && window.innerHeight > 450 && vv.height < window.innerHeight * 0.72
  );

  const isLandscape = width > height;
  const isCompactHeight = height < 520;
  const isMobile = width < 768 || isCompactHeight;
  const isTouchDevice =
    'ontouchstart' in window || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);

  return {
    width,
    height,
    isMobile,
    isLandscape,
    isCompactHeight,
    isKeyboardOpen,
    isTouchDevice,
  };
}

export function useViewport(): ViewportMetrics {
  const baselineRef = useRef(typeof window !== 'undefined' ? window.innerHeight : 720);
  const [metrics, setMetrics] = useState<ViewportMetrics>(() => readMetrics(baselineRef));

  useEffect(() => {
    let t1: number | null = null;
    let t2: number | null = null;

    const sync = () => {
      setMetrics(readMetrics(baselineRef));
    };

    const handleOrientation = () => {
      baselineRef.current = window.innerHeight;
      sync();
      if (t1) window.clearTimeout(t1);
      if (t2) window.clearTimeout(t2);
      t1 = window.setTimeout(() => {
        baselineRef.current = window.innerHeight;
        sync();
      }, 140);
      t2 = window.setTimeout(() => {
        baselineRef.current = window.innerHeight;
        sync();
      }, 360);
    };

    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', handleOrientation);
    window.visualViewport?.addEventListener('resize', sync);
    document.addEventListener('focusin', sync);
    document.addEventListener('focusout', sync);

    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', handleOrientation);
      window.visualViewport?.removeEventListener('resize', sync);
      document.removeEventListener('focusin', sync);
      document.removeEventListener('focusout', sync);
      if (t1) window.clearTimeout(t1);
      if (t2) window.clearTimeout(t2);
    };
  }, []);

  return metrics;
}
