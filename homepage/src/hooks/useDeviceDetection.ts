import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export function useDeviceDetection() {
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;

      // Check for touch capability
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsTouch(hasTouch);

      // Device detection based on screen width
      if (width < 768) {
        setDevice('mobile');
      } else if (width < 1024) {
        setDevice('tablet');
      } else {
        setDevice('desktop');
      }
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    window.addEventListener('touchstart', checkDevice);

    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('touchstart', checkDevice);
    };
  }, []);

  return { device, isTouch, isMobile: device === 'mobile', isTablet: device === 'tablet', isDesktop: device === 'desktop' };
}
