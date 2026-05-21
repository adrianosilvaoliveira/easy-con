import { cn } from '@/utils/cn';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-[10px] rounded-lg',
  md: 'h-9 w-9 text-xs rounded-lg sm:text-sm',
  lg: 'h-12 w-12 text-sm rounded-xl',
};

export function AppLogo({ size = 'md', className }: AppLogoProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center bg-primary-600 font-bold tracking-tight text-white',
        sizeClasses[size],
        className
      )}
      aria-hidden
    >
      CON
    </div>
  );
}
