import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import api from '@/services/api';
import { ExpirationAlertsModal } from '@/components/alerts/ExpirationAlertsModal';

export function NotificationBell() {
  const [modalOpen, setModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: count = 0 } = useQuery({
    queryKey: ['alerts-count'],
    queryFn: () => api.get('/batches/alerts/count').then((r) => r.data.data.count as number),
    refetchInterval: 60_000,
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="relative shrink-0 rounded-lg p-2 text-slate-300 hover:bg-slate-700/60"
        aria-label="Alertas de vencimento"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      <ExpirationAlertsModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ['alerts-count'] });
        }}
      />
    </>
  );
}
