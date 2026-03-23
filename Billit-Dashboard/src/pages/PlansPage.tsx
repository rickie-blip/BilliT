import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPlan, getPlans } from '@/lib/api';

export default function PlansPage() {
  const queryClient = useQueryClient();
  const { data: plans = [], isLoading, isError, error } = useQuery({ queryKey: ['plans'], queryFn: getPlans });
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [durationDays, setDurationDays] = useState('30');
  const [downloadMbps, setDownloadMbps] = useState('10');
  const [uploadMbps, setUploadMbps] = useState('10');

  const createMutation = useMutation({
    mutationFn: createPlan,
    onSuccess: async () => {
      setName('');
      setPrice('');
      await queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading plans...</div>;
  if (isError) return <div className="p-8 text-sm text-destructive">Failed to load plans: {error instanceof Error ? error.message : 'Unknown error'}</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="bg-card rounded-xl p-5 border border-border space-y-3">
        <h2 className="text-sm font-semibold">Create Service Plan</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Plan name" className="px-3 py-2 rounded-lg border border-border bg-background text-sm" />
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" type="number" className="px-3 py-2 rounded-lg border border-border bg-background text-sm" />
          <input value={durationDays} onChange={(e) => setDurationDays(e.target.value)} placeholder="Duration days" type="number" className="px-3 py-2 rounded-lg border border-border bg-background text-sm" />
          <input value={downloadMbps} onChange={(e) => setDownloadMbps(e.target.value)} placeholder="Down Mbps" type="number" className="px-3 py-2 rounded-lg border border-border bg-background text-sm" />
          <input value={uploadMbps} onChange={(e) => setUploadMbps(e.target.value)} placeholder="Up Mbps" type="number" className="px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        </div>
        <button
          type="button"
          onClick={() =>
            createMutation.mutate({
              name,
              price: Number(price),
              durationDays: Number(durationDays),
              downloadMbps: Number(downloadMbps),
              uploadMbps: Number(uploadMbps),
            })
          }
          className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-60"
          disabled={createMutation.isPending || !name || !price}
        >
          {createMutation.isPending ? 'Saving...' : 'Add Plan'}
        </button>
        {createMutation.isError && <p className="text-xs text-destructive">{createMutation.error instanceof Error ? createMutation.error.message : 'Failed'}</p>}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Price</th>
              <th className="text-left px-4 py-3">Duration</th>
              <th className="text-left px-4 py-3">Speed</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{plan.name}</td>
                <td className="px-4 py-3">KES {plan.price.toLocaleString()}</td>
                <td className="px-4 py-3">{plan.durationDays} days</td>
                <td className="px-4 py-3">{plan.downloadMbps}/{plan.uploadMbps} Mbps</td>
              </tr>
            ))}
            {plans.length === 0 && <tr><td className="px-4 py-5 text-muted-foreground" colSpan={4}>No plans yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
