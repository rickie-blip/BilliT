import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCustomers } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function CustomersPage() {
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended' | 'expired'>('all');
  const { data: customers = [], isPending, isError, error } = useQuery({
    queryKey: ['customers'],
    queryFn: getCustomers,
  });

  if (isPending) {
    return <div className="p-8 text-sm text-muted-foreground">Loading customers...</div>;
  }

  if (isError) {
    return (
      <div className="p-8 text-sm text-destructive">
        Failed to load customers: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  const filtered = filter === 'all' ? customers : customers.filter(c => c.status === filter);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-2">
        {(['all', 'active', 'suspended', 'expired'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors',
              filter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-muted'
            )}
          >
            {f} {f !== 'all' && `(${customers.filter(c => c.status === f).length})`}
            {f === 'all' && `(${customers.length})`}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-xl shadow-sm overflow-hidden animate-fade-up">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Plan</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Connection</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-5 py-3 font-medium text-muted-foreground">Balance</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-medium text-card-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.phone}</p>
                  </td>
                  <td className="px-5 py-3 text-card-foreground">{c.plan}</td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">{c.connectionType}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={cn(
                      'inline-flex items-center gap-1.5 text-xs font-medium',
                    )}>
                      <span className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        c.status === 'active' && 'bg-status-online',
                        c.status === 'suspended' && 'bg-status-warning',
                        c.status === 'expired' && 'bg-status-offline'
                      )} />
                      <span className="capitalize">{c.status}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium">
                    {c.balance > 0 ? <span className="text-destructive">KES {c.balance.toLocaleString()}</span> : <span className="text-status-online">Paid</span>}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{c.dueDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
