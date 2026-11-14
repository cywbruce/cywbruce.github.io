import { useEffect } from 'react';

/**
 * Detects if the device is likely an e-ink device or has poor touch responsiveness.
 * Adds a class to the body for CSS optimizations.
 */
export function TouchOptimizer() {
  useEffect(() => {
    // Detect monochrome screen (likely e-ink)
    const isMonochrome = window.matchMedia('(monochrome)').matches;
    
    // Detect slow pointer (coarse or none)
    const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const hasNoPointer = window.matchMedia('(pointer: none)').matches;
    
    // Detect small screen
    const isSmallScreen = window.innerWidth <= 640;
    
    // Add class to body for CSS targeting
    if (isMonochrome || hasNoPointer || (hasCoarsePointer && isSmallScreen)) {
      document.body.classList.add('kindle-device');
    }
    
    // Add touch feedback class
    const handleTouchStart = () => {
      document.body.classList.add('using-touch');
    };
    
    const handleMouseDown = () => {
      document.body.classList.remove('using-touch');
    };
    
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('mousedown', handleMouseDown, { passive: true });
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);
  
  return null;
}
