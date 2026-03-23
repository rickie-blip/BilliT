import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { generateInvoices, getInvoices, markInvoicePaid } from '@/lib/api';

export default function BillingPage() {
  const queryClient = useQueryClient();
  const { data: invoices = [], isLoading, isError, error } = useQuery({ queryKey: ['invoices'], queryFn: getInvoices });

  const generateMutation = useMutation({
    mutationFn: generateInvoices,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
  });

  const payMutation = useMutation({
    mutationFn: markInvoicePaid,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['customers'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
  });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading invoices...</div>;
  if (isError) return <div className="p-8 text-sm text-destructive">Failed to load invoices: {error instanceof Error ? error.message : 'Unknown error'}</div>;

  return (
    <div className="p-8 space-y-5">
      <div className="flex items-center justify-between bg-card border border-border rounded-xl p-4">
        <div>
          <h2 className="text-sm font-semibold">Billing Operations</h2>
          <p className="text-xs text-muted-foreground">Generate current-period invoices and mark payments.</p>
        </div>
        <button
          type="button"
          className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-60"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? 'Generating...' : 'Generate Invoices'}
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="text-left px-4 py-3">Customer</th>
              <th className="text-left px-4 py-3">Plan</th>
              <th className="text-left px-4 py-3">Period</th>
              <th className="text-left px-4 py-3">Amount</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{invoice.customerName}</td>
                <td className="px-4 py-3">{invoice.plan}</td>
                <td className="px-4 py-3">{invoice.period}</td>
                <td className="px-4 py-3">KES {invoice.amount.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={invoice.status === 'paid' ? 'text-status-online' : 'text-status-warning'}>{invoice.status}</span>
                </td>
                <td className="px-4 py-3">
                  {invoice.status !== 'paid' ? (
                    <button
                      type="button"
                      onClick={() => payMutation.mutate(invoice.id)}
                      className="px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-xs"
                      disabled={payMutation.isPending}
                    >
                      Mark Paid
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Paid {invoice.paidAt || ''}</span>
                  )}
                </td>
              </tr>
            ))}
            {invoices.length === 0 && <tr><td className="px-4 py-5 text-muted-foreground" colSpan={6}>No invoices available.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
