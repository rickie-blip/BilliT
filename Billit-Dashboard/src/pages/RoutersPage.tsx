import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { AlertTriangle, ArrowUpDown, Cpu, HardDrive, Plus, PlugZap, Settings, UserX, Wifi, WifiOff } from 'lucide-react';
import {
  configureRouter,
  createRouter,
  disconnectRouterUser,
  getRouters,
  getRouterSessions,
  testRouterConnection,
} from '@/lib/api';
import type { RouterDevice } from '@/types/domain';

type RouterStatus = 'online' | 'warning' | 'offline';

type RouterFormState = {
  id: string;
  name: string;
  ipAddress: string;
  location: string;
  status: RouterStatus;
  connectedUsers: string;
  cpuLoad: string;
  memoryUsage: string;
  bandwidthUp: string;
  bandwidthDown: string;
  apiPort: string;
  apiUsername: string;
  apiPassword: string;
  allowedSourceIp: string;
  command: string;
};

type NewRouterFormState = {
  name: string;
  model: string;
  ipAddress: string;
  location: string;
  status: RouterStatus;
  apiPort: string;
  apiUsername: string;
  apiPassword: string;
  allowedSourceIp: string;
};

const toFormState = (router: RouterDevice): RouterFormState => ({
  id: router.id,
  name: router.name,
  ipAddress: router.ipAddress,
  location: router.location,
  status: router.status,
  connectedUsers: String(router.connectedUsers),
  cpuLoad: String(router.cpuLoad),
  memoryUsage: String(router.memoryUsage),
  bandwidthUp: String(router.bandwidth.up),
  bandwidthDown: String(router.bandwidth.down),
  apiPort: String(router.apiPort || 8728),
  apiUsername: router.apiUsername || '',
  apiPassword: router.apiPassword || '',
  allowedSourceIp: router.allowedSourceIp || '',
  command: router.lastCommand || '',
});

const initialNewRouterForm: NewRouterFormState = {
  name: '',
  model: '',
  ipAddress: '',
  location: '',
  status: 'offline',
  apiPort: '8728',
  apiUsername: '',
  apiPassword: '',
  allowedSourceIp: '',
};

export default function RoutersPage() {
  const queryClient = useQueryClient();
  const { data: routers = [], isLoading, isError, error } = useQuery({
    queryKey: ['routers'],
    queryFn: getRouters,
  });

  const [editingRouterId, setEditingRouterId] = useState<string | null>(null);
  const [form, setForm] = useState<RouterFormState | null>(null);
  const [routerTestMessage, setRouterTestMessage] = useState<string>('');
  const [sessionsRouterId, setSessionsRouterId] = useState<string | null>(null);
  const [disconnectUsername, setDisconnectUsername] = useState<string>('');
  const [showAddRouterModal, setShowAddRouterModal] = useState(false);
  const [newRouterForm, setNewRouterForm] = useState<NewRouterFormState>(initialNewRouterForm);

  const sessionsQuery = useQuery({
    queryKey: ['router-sessions', sessionsRouterId],
    queryFn: () => getRouterSessions(sessionsRouterId as string),
    enabled: Boolean(sessionsRouterId),
  });

  const editingRouter = useMemo(
    () => routers.find((router) => router.id === editingRouterId) || null,
    [editingRouterId, routers]
  );

  const configureMutation = useMutation({
    mutationFn: configureRouter,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['routers'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      setEditingRouterId(null);
      setForm(null);
    },
  });

  const createRouterMutation = useMutation({
    mutationFn: createRouter,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['routers'] });
      setShowAddRouterModal(false);
      setNewRouterForm(initialNewRouterForm);
    },
  });

  const testMutation = useMutation({
    mutationFn: testRouterConnection,
    onSuccess: async (result) => {
      setRouterTestMessage(result.message);
      await queryClient.invalidateQueries({ queryKey: ['routers'] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: ({ routerId, username }: { routerId: string; username: string }) =>
      disconnectRouterUser(routerId, username),
    onSuccess: async () => {
      setDisconnectUsername('');
      await queryClient.invalidateQueries({ queryKey: ['router-sessions', sessionsRouterId] });
    },
  });

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading routers...</div>;
  }

  if (isError) {
    return (
      <div className="p-8 text-sm text-destructive">
        Failed to load routers: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowAddRouterModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm"
        >
          <Plus className="w-4 h-4" /> Add Router
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {routers.map((r, i) => {
          const StatusIcon = r.status === 'online' ? Wifi : r.status === 'warning' ? AlertTriangle : WifiOff;
          return (
            <div
              key={r.id}
              className="bg-card rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow animate-fade-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-card-foreground">{r.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {r.model} - {r.location}
                  </p>
                  <p className="text-[11px] text-muted-foreground">API {r.ipAddress}:{r.apiPort || 8728}</p>
                  {r.lastConfiguredAt && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Last configured {r.lastConfiguredAt}
                      {r.lastConfiguredBy ? ` by ${r.lastConfiguredBy}` : ''}
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                    r.status === 'online' && 'bg-status-online/10 text-status-online',
                    r.status === 'warning' && 'bg-status-warning/10 text-status-warning',
                    r.status === 'offline' && 'bg-status-offline/10 text-status-offline'
                  )}
                >
                  <StatusIcon className="w-3 h-3" />
                  {r.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Cpu className="w-3 h-3" /> CPU
                  </p>
                  <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', r.cpuLoad > 70 ? 'bg-status-warning' : 'bg-primary')}
                      style={{ width: `${r.cpuLoad}%` }}
                    />
                  </div>
                  <p className="text-xs font-medium tabular-nums mt-0.5">{r.cpuLoad}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <HardDrive className="w-3 h-3" /> Memory
                  </p>
                  <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', r.memoryUsage > 70 ? 'bg-status-warning' : 'bg-primary')}
                      style={{ width: `${r.memoryUsage}%` }}
                    />
                  </div>
                  <p className="text-xs font-medium tabular-nums mt-0.5">{r.memoryUsage}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <ArrowUpDown className="w-3 h-3" /> Bandwidth
                  </p>
                  <p className="text-xs font-medium tabular-nums mt-2">
                    Up {r.bandwidth.up} / Down {r.bandwidth.down} Mbps
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground border-t border-border pt-3">
                <span>{r.connectedUsers} users connected</span>
                <span>Uptime: {r.uptime}</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingRouterId(r.id);
                    setForm(toFormState(r));
                    setRouterTestMessage('');
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90"
                >
                  <Settings className="w-3.5 h-3.5" /> Configure
                </button>
                <button
                  type="button"
                  onClick={() => setSessionsRouterId(r.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground hover:opacity-90"
                >
                  <UserX className="w-3.5 h-3.5" /> Sessions
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {editingRouter && form && (
        <div className="fixed inset-0 z-50 bg-black/45 grid place-items-center p-4">
          <div className="w-full max-w-3xl bg-card border border-border rounded-xl shadow-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-card-foreground">Configure {editingRouter.name}</h3>
                <p className="text-xs text-muted-foreground">RouterOS API / RADIUS related settings.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingRouterId(null);
                  setForm(null);
                }}
                className="text-xs px-2 py-1 rounded-md border border-border hover:bg-muted"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></div>
              <div><label className="text-xs text-muted-foreground">IP Address</label><input value={form.ipAddress} onChange={(e) => setForm({ ...form, ipAddress: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></div>
              <div><label className="text-xs text-muted-foreground">Location</label><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></div>
              <div><label className="text-xs text-muted-foreground">Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as RouterStatus })} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"><option value="online">online</option><option value="warning">warning</option><option value="offline">offline</option></select></div>
              <div><label className="text-xs text-muted-foreground">API Port</label><input type="number" value={form.apiPort} onChange={(e) => setForm({ ...form, apiPort: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></div>
              <div><label className="text-xs text-muted-foreground">API Username</label><input value={form.apiUsername} onChange={(e) => setForm({ ...form, apiUsername: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></div>
              <div><label className="text-xs text-muted-foreground">API Password</label><input type="password" value={form.apiPassword} onChange={(e) => setForm({ ...form, apiPassword: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></div>
              <div><label className="text-xs text-muted-foreground">Allowed Source IP</label><input value={form.allowedSourceIp} onChange={(e) => setForm({ ...form, allowedSourceIp: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></div>
              <div><label className="text-xs text-muted-foreground">Connected Users</label><input type="number" value={form.connectedUsers} onChange={(e) => setForm({ ...form, connectedUsers: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></div>
              <div><label className="text-xs text-muted-foreground">CPU Load %</label><input type="number" value={form.cpuLoad} onChange={(e) => setForm({ ...form, cpuLoad: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></div>
              <div><label className="text-xs text-muted-foreground">Memory Usage %</label><input type="number" value={form.memoryUsage} onChange={(e) => setForm({ ...form, memoryUsage: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></div>
              <div><label className="text-xs text-muted-foreground">Command / Note</label><input value={form.command} onChange={(e) => setForm({ ...form, command: e.target.value })} placeholder="e.g. /ppp profile set 1 rate-limit=10M/10M" className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></div>
              <div><label className="text-xs text-muted-foreground">Bandwidth Up (Mbps)</label><input type="number" value={form.bandwidthUp} onChange={(e) => setForm({ ...form, bandwidthUp: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></div>
              <div><label className="text-xs text-muted-foreground">Bandwidth Down (Mbps)</label><input type="number" value={form.bandwidthDown} onChange={(e) => setForm({ ...form, bandwidthDown: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></div>
            </div>

            {routerTestMessage && <p className="text-xs text-muted-foreground">Connection test: {routerTestMessage}</p>}
            {configureMutation.isError && <p className="text-xs text-destructive">{configureMutation.error instanceof Error ? configureMutation.error.message : 'Failed to configure router'}</p>}
            {testMutation.isError && <p className="text-xs text-destructive">{testMutation.error instanceof Error ? testMutation.error.message : 'Failed to test connection'}</p>}

            <div className="flex justify-between gap-2">
              <button
                type="button"
                disabled={testMutation.isPending}
                onClick={() => testMutation.mutate(form.id)}
                className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                <PlugZap className="w-4 h-4" /> {testMutation.isPending ? 'Testing...' : 'Test Connection'}
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setEditingRouterId(null); setForm(null); }} className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted">Cancel</button>
                <button
                  type="button"
                  disabled={configureMutation.isPending}
                  onClick={() =>
                    configureMutation.mutate({
                      routerId: form.id,
                      name: form.name,
                      ipAddress: form.ipAddress,
                      location: form.location,
                      status: form.status,
                      connectedUsers: Number(form.connectedUsers),
                      cpuLoad: Number(form.cpuLoad),
                      memoryUsage: Number(form.memoryUsage),
                      bandwidthUp: Number(form.bandwidthUp),
                      bandwidthDown: Number(form.bandwidthDown),
                      apiPort: Number(form.apiPort),
                      apiUsername: form.apiUsername,
                      apiPassword: form.apiPassword,
                      allowedSourceIp: form.allowedSourceIp,
                      command: form.command || undefined,
                    })
                  }
                  className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-60"
                >
                  {configureMutation.isPending ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {sessionsRouterId && (
        <div className="fixed inset-0 z-40 bg-black/40 grid place-items-center p-4">
          <div className="w-full max-w-xl bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Active Sessions</h3>
              <button type="button" className="text-xs px-2 py-1 border border-border rounded-md" onClick={() => setSessionsRouterId(null)}>Close</button>
            </div>
            {sessionsQuery.isLoading && <p className="text-xs text-muted-foreground">Loading sessions...</p>}
            {sessionsQuery.isError && <p className="text-xs text-destructive">Failed to load sessions</p>}
            {sessionsQuery.data && (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {sessionsQuery.data.map((session, idx) => (
                  <div key={`${session.username}-${idx}`} className="border border-border rounded-lg p-2 text-xs flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-card-foreground">{session.username}</p>
                      <p className="text-muted-foreground">{session.ipAddress} · {session.sessionTime} · {session.bandwidthUsage}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDisconnectUsername(session.username)}
                      className="px-2 py-1 rounded-md bg-secondary text-secondary-foreground"
                    >
                      Disconnect
                    </button>
                  </div>
                ))}
                {sessionsQuery.data.length === 0 && <p className="text-xs text-muted-foreground">No active sessions.</p>}
              </div>
            )}
            {disconnectUsername && (
              <div className="border-t border-border pt-3 space-y-2">
                <p className="text-xs">Disconnect <span className="font-medium">{disconnectUsername}</span>?</p>
                <button
                  type="button"
                  onClick={() => disconnectMutation.mutate({ routerId: sessionsRouterId, username: disconnectUsername })}
                  className="px-2 py-1 text-xs rounded-md bg-destructive text-destructive-foreground disabled:opacity-60"
                  disabled={disconnectMutation.isPending}
                >
                  {disconnectMutation.isPending ? 'Sending...' : 'Confirm Disconnect'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showAddRouterModal && (
        <div className="fixed inset-0 z-50 bg-black/45 grid place-items-center p-4">
          <div className="w-full max-w-xl bg-card border border-border rounded-xl shadow-xl p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-card-foreground">Add New Router</h3>
                <p className="text-xs text-muted-foreground">Create and configure a new router device.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddRouterModal(false)}
                className="text-xs px-2 py-1 rounded-md border border-border hover:bg-muted"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Name</label><input value={newRouterForm.name} onChange={(e) => setNewRouterForm({ ...newRouterForm, name: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></div>
              <div><label className="text-xs text-muted-foreground">Model</label><input value={newRouterForm.model} onChange={(e) => setNewRouterForm({ ...newRouterForm, model: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></div>
              <div><label className="text-xs text-muted-foreground">IP Address</label><input value={newRouterForm.ipAddress} onChange={(e) => setNewRouterForm({ ...newRouterForm, ipAddress: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></div>
              <div><label className="text-xs text-muted-foreground">Location</label><input value={newRouterForm.location} onChange={(e) => setNewRouterForm({ ...newRouterForm, location: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></div>
              <div><label className="text-xs text-muted-foreground">Status</label><select value={newRouterForm.status} onChange={(e) => setNewRouterForm({ ...newRouterForm, status: e.target.value as RouterStatus })} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"><option value="online">online</option><option value="warning">warning</option><option value="offline">offline</option></select></div>
              <div><label className="text-xs text-muted-foreground">API Port</label><input type="number" value={newRouterForm.apiPort} onChange={(e) => setNewRouterForm({ ...newRouterForm, apiPort: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></div>
              <div><label className="text-xs text-muted-foreground">API Username</label><input value={newRouterForm.apiUsername} onChange={(e) => setNewRouterForm({ ...newRouterForm, apiUsername: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></div>
              <div><label className="text-xs text-muted-foreground">API Password</label><input type="password" value={newRouterForm.apiPassword} onChange={(e) => setNewRouterForm({ ...newRouterForm, apiPassword: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></div>
              <div className="md:col-span-2"><label className="text-xs text-muted-foreground">Allowed Source IP</label><input value={newRouterForm.allowedSourceIp} onChange={(e) => setNewRouterForm({ ...newRouterForm, allowedSourceIp: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></div>
            </div>

            {createRouterMutation.isError && (
              <p className="text-xs text-destructive">
                {createRouterMutation.error instanceof Error ? createRouterMutation.error.message : 'Failed to create router'}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddRouterModal(false)} className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted">Cancel</button>
              <button
                type="button"
                disabled={createRouterMutation.isPending || !newRouterForm.name || !newRouterForm.model || !newRouterForm.ipAddress}
                onClick={() =>
                  createRouterMutation.mutate({
                    name: newRouterForm.name,
                    model: newRouterForm.model,
                    ipAddress: newRouterForm.ipAddress,
                    location: newRouterForm.location || undefined,
                    status: newRouterForm.status,
                    apiPort: Number(newRouterForm.apiPort),
                    apiUsername: newRouterForm.apiUsername || undefined,
                    apiPassword: newRouterForm.apiPassword || undefined,
                    allowedSourceIp: newRouterForm.allowedSourceIp || undefined,
                  })
                }
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-60"
              >
                {createRouterMutation.isPending ? 'Adding...' : 'Add Router'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
