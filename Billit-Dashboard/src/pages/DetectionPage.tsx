import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, UserPlus, Wifi, WifiOff } from 'lucide-react';
import { assignDetectedUser, getCustomers, getDetectedUsers, getRouters, syncDetectedUsers } from '@/lib/api';
import type { DetectedUsersSyncResponse } from '@/types/domain';
import { cn } from '@/lib/utils';

export default function DetectionPage() {
  const queryClient = useQueryClient();
  const [selectedCustomers, setSelectedCustomers] = useState<Record<string, string>>({});
  const [lastSync, setLastSync] = useState<DetectedUsersSyncResponse | null>(null);

  const { data: detectedUsers = [], isPending: loadingUsers } = useQuery({
    queryKey: ['detected-users'],
    queryFn: getDetectedUsers,
  });

  const { data: customers = [], isPending: loadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: getCustomers,
  });

  const { data: routers = [] } = useQuery({
    queryKey: ['routers'],
    queryFn: getRouters,
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

  const syncMutation = useMutation({
    mutationFn: syncDetectedUsers,
    onSuccess: async (data) => {
      setLastSync(data);
      queryClient.setQueryData(['detected-users'], data.detectedUsers);
      queryClient.setQueryData(['routers'], data.routers);
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  if (loadingUsers || loadingCustomers) {
    return <div className="p-8 text-sm text-muted-foreground">Loading detected users...</div>;
  }

  const unregistered = detectedUsers.filter((u) => u.status === 'unregistered');
  const registered = detectedUsers.filter((u) => u.status === 'registered');
  const getSelectedCustomerId = (id: string) => selectedCustomers[id] || customers[0]?.id || '';

  const syncEnabledRouters = routers.filter((r) => r.syncEnabled !== false);

  return (
    <div className="p-8 space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Device Detection</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {detectedUsers.length} device{detectedUsers.length !== 1 ? 's' : ''} on record
            {lastSync && (
              <span className={cn('ml-2 text-xs font-medium', lastSync.fallback ? 'text-muted-foreground' : 'text-status-online')}>
                {lastSync.fallback ? '· fallback data' : `· live from ${lastSync.synced} router${lastSync.synced !== 1 ? 's' : ''}`}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending || syncEnabledRouters.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
          title={syncEnabledRouters.length === 0 ? 'No routers with sync enabled' : 'Pull live data from routers'}
        >
          <RefreshCw className={cn('w-4 h-4', syncMutation.isPending && 'animate-spin')} />
          {syncMutation.isPending ? 'Syncing…' : 'Sync From Routers'}
        </button>
      </div>

      {/* Sync results */}
      {lastSync && lastSync.results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {lastSync.results.map((r) => {
            const router = routers.find((rt) => rt.id === r.routerId);
            return (
              <div
                key={r.routerId}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-3 text-sm',
                  r.ok ? 'border-status-online/30 bg-status-online/5' : 'border-destructive/30 bg-destructive/5'
                )}
              >
                {r.ok ? (
                  <Wifi className="w-4 h-4 text-status-online mt-0.5 shrink-0" />
                ) : (
                  <WifiOff className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-medium text-card-foreground truncate">{router?.name ?? r.routerId}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.ok ? `${r.usersFound} user${r.usersFound !== 1 ? 's' : ''} found` : r.message}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {syncMutation.isError && (
        <p className="text-xs text-destructive">
          {syncMutation.error instanceof Error ? syncMutation.error.message : 'Sync failed'}
        </p>
      )}

      {/* Unregistered alert */}
      {unregistered.length > 0 && (
        <div className="bg-status-warning/10 border border-status-warning/30 rounded-xl p-4">
          <p className="text-sm font-medium text-foreground">
            {unregistered.length} unregistered device{unregistered.length > 1 ? 's' : ''} detected
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            These devices are using bandwidth but have no billing account assigned.
          </p>
        </div>
      )}

      {/* Users table */}
      <div className="bg-card rounded-xl shadow-sm overflow-hidden">
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
                  <tr
                    key={user.id}
                    className={cn(
                      'border-b border-border last:border-0 hover:bg-muted/30 transition-colors',
                      user.status === 'unregistered' && 'bg-status-warning/5'
                    )}
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-card-foreground">{user.hostname}</p>
                      {user.assignedCustomer && (
                        <p className="text-xs text-muted-foreground">{user.assignedCustomer}</p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-xs font-mono text-card-foreground">{user.macAddress}</p>
                      <p className="text-xs text-muted-foreground">{user.ipAddress}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                        {user.detectionMethod}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground text-xs">{user.router}</td>
                    <td className="px-5 py-3 tabular-nums text-card-foreground">{user.dataUsage}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        <span
                          className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            user.status === 'registered' ? 'bg-status-online' : 'bg-status-warning'
                          )}
                        />
                        <span className="capitalize">{user.status}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {user.status === 'unregistered' && (
                        <div className="flex flex-col gap-2 min-w-[220px]">
                          <select
                            value={chosenCustomerId}
                            onChange={(e) =>
                              setSelectedCustomers((prev) => ({ ...prev, [user.id]: e.target.value }))
                            }
                            className="px-2 py-1.5 rounded-lg text-xs border border-border bg-background"
                          >
                            {customers.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() =>
                              assignMutation.mutate({ detectedUserId: user.id, customerId: chosenCustomerId })
                            }
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
              {detectedUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No devices detected yet. Click <strong>Sync From Routers</strong> to pull live data.
                  </td>
                </tr>
              )}
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
