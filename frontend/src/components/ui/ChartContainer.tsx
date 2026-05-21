import { useEffect, useRef, useState, ReactNode } from 'react';

interface ChartContainerProps {
  height?: number;
  mobileHeight?: number;
  children: (size: { width: number; height: number }) => ReactNode;
}

export function ChartContainer({
  height = 280,
  mobileHeight = 220,
  children,
}: ChartContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const h = window.innerWidth < 640 ? mobileHeight : height;
      setSize({ width: Math.max(rect.width, 200), height: h });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [height, mobileHeight]);

  return (
    <div ref={ref} className="w-full min-w-0" style={{ minHeight: mobileHeight }}>
      {size.width > 0 && children(size)}
    </div>
  );
}
