import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createCustomer, getCustomers, getPlans, getRouters } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Customer, Plan, RouterDevice } from '@/types/domain';

type CustomerStatus = Customer['status'];
type ConnectionType = Customer['connectionType'];

type NewCustomerFormState = {
  name: string;
  phone: string;
  email: string;
  location: string;
  plan: string;
  monthlyFee: string;
  status: CustomerStatus;
  connectionType: ConnectionType;
  macAddress: string;
  ipAddress: string;
  router: string;
  lastPayment: string;
  dueDate: string;
  balance: string;
};

const toDateInputValue = (date: Date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
};

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const initialFormState = (): NewCustomerFormState => ({
  name: '',
  phone: '',
  email: '',
  location: '',
  plan: '',
  monthlyFee: '',
  status: 'active',
  connectionType: 'DHCP',
  macAddress: '',
  ipAddress: '',
  router: '',
  lastPayment: '',
  dueDate: toDateInputValue(addDays(new Date(), 30)),
  balance: '0',
});

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended' | 'expired'>('all');
  const [form, setForm] = useState<NewCustomerFormState>(() => initialFormState());
  const { data: customers = [], isPending, isError, error } = useQuery({
    queryKey: ['customers'],
    queryFn: getCustomers,
  });
  const { data: plans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: getPlans,
  });
  const { data: routers = [] } = useQuery({
    queryKey: ['routers'],
    queryFn: getRouters,
  });

  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: async () => {
      setForm(initialFormState());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['customers'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
  });

  const planOptions = useMemo(
    () => plans.map((plan: Plan) => ({ name: plan.name, price: plan.price })),
    [plans]
  );
  const routerOptions = useMemo(
    () => routers.map((router: RouterDevice) => router.name),
    [routers]
  );

  const handlePlanChange = (value: string) => {
    const matchedPlan = planOptions.find((plan) => plan.name === value);
    setForm((current) => ({
      ...current,
      plan: value,
      monthlyFee: matchedPlan ? String(matchedPlan.price) : current.monthlyFee,
    }));
  };

  const handleRouterChange = (value: string) => {
    setForm((current) => ({ ...current, router: value }));
  };

  const handleSubmit = () => {
    createMutation.mutate({
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      location: form.location.trim() || undefined,
      plan: form.plan.trim(),
      monthlyFee: Number(form.monthlyFee),
      status: form.status,
      connectionType: form.connectionType,
      macAddress: form.macAddress.trim() || undefined,
      ipAddress: form.ipAddress.trim() || undefined,
      router: form.router.trim() || undefined,
      lastPayment: form.lastPayment || undefined,
      dueDate: form.dueDate || undefined,
      balance: Number(form.balance),
    });
  };

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
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-card-foreground">Add Customer</h2>
            <p className="text-xs text-muted-foreground">
              Manually create a subscriber with billing, device, and connection details.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setForm(initialFormState())}
            className="text-xs px-3 py-2 rounded-lg border border-border text-muted-foreground hover:bg-muted"
          >
            Reset
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Full Name *</label>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              placeholder="Customer name"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Phone *</label>
            <input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              placeholder="07..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              placeholder="name@example.com"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Location</label>
            <input
              value={form.location}
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              placeholder="Area / estate"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Plan *</label>
            <input
              list="customer-plan-options"
              value={form.plan}
              onChange={(event) => handlePlanChange(event.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              placeholder="Select or type plan"
            />
            <datalist id="customer-plan-options">
              {planOptions.map((plan) => (
                <option key={plan.name} value={plan.name} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Monthly Fee *</label>
            <input
              type="number"
              value={form.monthlyFee}
              onChange={(event) => setForm((current) => ({ ...current, monthlyFee: event.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              placeholder="2500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <select
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CustomerStatus }))}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <option value="active">active</option>
              <option value="suspended">suspended</option>
              <option value="expired">expired</option>
              <option value="disabled">disabled</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Connection Type</label>
            <select
              value={form.connectionType}
              onChange={(event) =>
                setForm((current) => ({ ...current, connectionType: event.target.value as ConnectionType }))
              }
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <option value="PPPoE">PPPoE</option>
              <option value="DHCP">DHCP</option>
              <option value="Static">Static</option>
              <option value="Hotspot">Hotspot</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Router</label>
            <select
              value={form.router}
              onChange={(event) => handleRouterChange(event.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            >
              <option value="">Unassigned</option>
              {routerOptions.map((routerName) => (
                <option key={routerName} value={routerName}>
                  {routerName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">MAC Address</label>
            <input
              value={form.macAddress}
              onChange={(event) => setForm((current) => ({ ...current, macAddress: event.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              placeholder="AA:BB:CC:DD:EE:FF"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">IP Address</label>
            <input
              value={form.ipAddress}
              onChange={(event) => setForm((current) => ({ ...current, ipAddress: event.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              placeholder="10.0.0.10"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Last Payment</label>
            <input
              type="date"
              value={form.lastPayment}
              onChange={(event) => setForm((current) => ({ ...current, lastPayment: event.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Due Date</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Balance</label>
            <input
              type="number"
              value={form.balance}
              onChange={(event) => setForm((current) => ({ ...current, balance: event.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              placeholder="0"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Fields marked with * are required. Plan suggestions come from your current service plans.
          </p>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createMutation.isPending || !form.name || !form.phone || !form.plan || !form.monthlyFee}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
          >
            <span className="text-base leading-none">+</span>
            {createMutation.isPending ? 'Saving...' : 'Save Customer'}
          </button>
        </div>

        {createMutation.isError && (
          <p className="text-xs text-destructive">
            {createMutation.error instanceof Error ? createMutation.error.message : 'Failed to create customer'}
          </p>
        )}
      </div>

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
