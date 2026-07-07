import { Loader2 } from 'lucide-react';

export function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary-500" aria-label="Carregando" />
    </div>
  );
}
