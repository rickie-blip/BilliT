import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { assignDetectedUser, getCustomers, getDetectedUsers } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function DetectionPage() {
  const queryClient = useQueryClient();
  const [selectedCustomers, setSelectedCustomers] = useState<Record<string, string>>({});

  const {
    data: detectedUsers = [],
    isPending: loadingUsers,
    isError: usersError,
    error: usersErrorMessage,
  } = useQuery({
    queryKey: ['detected-users'],
    queryFn: getDetectedUsers,
  });

  const {
    data: customers = [],
    isPending: loadingCustomers,
    isError: customersError,
    error: customersErrorMessage,
  } = useQuery({
    queryKey: ['customers'],
    queryFn: getCustomers,
  });

  const assignMutation = useMutation({
    mutationFn: assignDetectedUser,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['detected-users'] }),
        queryClient.invalidateQueries({ queryKey: ['customers'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
  });

  if (loadingUsers || loadingCustomers) {
    return <div className="p-8 text-sm text-muted-foreground">Loading detected users...</div>;
  }

  if (usersError || customersError) {
    const message =
      (usersErrorMessage instanceof Error && usersErrorMessage.message) ||
      (customersErrorMessage instanceof Error && customersErrorMessage.message) ||
      'Unknown error';

    return <div className="p-8 text-sm text-destructive">Failed to load detection data: {message}</div>;
  }

  const unregistered = detectedUsers.filter((user) => user.status === 'unregistered');
  const registered = detectedUsers.filter((user) => user.status === 'registered');

  const getSelectedCustomerId = (detectedUserId: string) =>
    selectedCustomers[detectedUserId] || customers[0]?.id || '';

  return (
    <div className="p-8 space-y-6">
      {unregistered.length > 0 && (
        <div className="bg-status-warning/10 border border-status-warning/30 rounded-xl p-4 animate-fade-up">
          <p className="text-sm font-medium text-foreground">
            {unregistered.length} unregistered device{unregistered.length > 1 ? 's' : ''} detected on the network
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            These devices are using bandwidth but have no billing account assigned.
          </p>
        </div>
      )}

      <div className="bg-card rounded-xl shadow-sm overflow-hidden animate-fade-up" style={{ animationDelay: '80ms' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Device</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">MAC / IP</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Method</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Router</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Data Usage</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {[...unregistered, ...registered].map((user) => {
                const chosenCustomerId = getSelectedCustomerId(user.id);
                return (
                  <tr key={user.id} className={cn('border-b border-border last:border-0 hover:bg-muted/30 transition-colors', user.status === 'unregistered' && 'bg-status-warning/5')}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-card-foreground">{user.hostname}</p>
                      {user.assignedCustomer && <p className="text-xs text-muted-foreground">{user.assignedCustomer}</p>}
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-xs font-mono text-card-foreground">{user.macAddress}</p>
                      <p className="text-xs text-muted-foreground">{user.ipAddress}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">{user.detectionMethod}</span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">{user.router}</td>
                    <td className="px-5 py-3 tabular-nums text-card-foreground">{user.dataUsage}</td>
                    <td className="px-5 py-3">
                      <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium')}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', user.status === 'registered' ? 'bg-status-online' : 'bg-status-warning')} />
                        <span className="capitalize">{user.status}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {user.status === 'unregistered' && (
                        <div className="flex flex-col gap-2 min-w-[220px]">
                          <select
                            value={chosenCustomerId}
                            onChange={(event) =>
                              setSelectedCustomers((prev) => ({ ...prev, [user.id]: event.target.value }))
                            }
                            className="px-2 py-1.5 rounded-lg text-xs border border-border bg-background"
                          >
                            {customers.map((customer) => (
                              <option key={customer.id} value={customer.id}>
                                {customer.name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => assignMutation.mutate({ detectedUserId: user.id, customerId: chosenCustomerId })}
                            disabled={!chosenCustomerId || assignMutation.isPending}
                            className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity active:scale-[0.97] disabled:opacity-50"
                          >
                            <UserPlus className="w-3 h-3" /> Assign
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {assignMutation.isError && (
        <p className="text-xs text-destructive">
          {assignMutation.error instanceof Error ? assignMutation.error.message : 'Failed to assign user'}
        </p>
      )}
    </div>
  );
}
