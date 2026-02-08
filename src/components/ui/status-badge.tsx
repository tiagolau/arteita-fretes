import { cn } from '@/lib/utils';

type Status = 'PENDENTE' | 'VALIDADO' | 'REJEITADO';

const statusStyles: Record<Status, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-800',
  VALIDADO: 'bg-green-100 text-green-800',
  REJEITADO: 'bg-red-100 text-red-800',
};

const statusLabels: Record<Status, string> = {
  PENDENTE: 'Pendente',
  VALIDADO: 'Validado',
  REJEITADO: 'Rejeitado',
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        statusStyles[status],
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
