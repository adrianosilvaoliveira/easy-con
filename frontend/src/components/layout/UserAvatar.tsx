import { cn } from '@/utils/cn';

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

interface UserAvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-9 w-9 text-sm sm:h-10 sm:w-10',
};

export function UserAvatar({ name, imageUrl, size = 'md', className }: UserAvatarProps) {
  const label = initialsFromName(name);

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={cn(
          'shrink-0 rounded-full object-cover ring-2 ring-slate-600',
          sizeClasses[size],
          className
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-primary-600 font-semibold text-white ring-2 ring-slate-600',
        sizeClasses[size],
        className
      )}
      aria-hidden
    >
      {label}
    </span>
  );
}
