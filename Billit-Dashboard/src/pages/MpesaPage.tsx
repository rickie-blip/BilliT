import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Send, CheckCircle, Clock, XCircle } from 'lucide-react';
import { getCustomers, getMpesaTransactions, sendStkPush } from '@/lib/api';

export default function MpesaPage() {
  const queryClient = useQueryClient();
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [sent, setSent] = useState(false);

  const {
    data: customers = [],
    isPending: customersLoading,
    isError: customersError,
    error: customersErrorMessage,
  } = useQuery({
    queryKey: ['customers'],
    queryFn: getCustomers,
  });

  const {
    data: mpesaTransactions = [],
    isPending: transactionsLoading,
    isError: transactionsError,
    error: transactionsErrorMessage,
  } = useQuery({
    queryKey: ['mpesa-transactions'],
    queryFn: getMpesaTransactions,
  });

  const stkPushMutation = useMutation({
    mutationFn: sendStkPush,
    onSuccess: async () => {
      setSent(true);
      setTimeout(() => setSent(false), 3000);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mpesa-transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
  });

  const handleStkPush = async () => {
    const parsedAmount = Number(amount);
    if (!phone || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return;
    }

    await stkPushMutation.mutateAsync({
      phone,
      amount: parsedAmount,
      customerId: selectedCustomerId || undefined,
    });
    setAmount('');
  };

  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const customer = customers.find((item) => item.id === customerId);
    if (customer) {
      setPhone(customer.phone);
    }
  };

  if (customersLoading || transactionsLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading M-Pesa data...</div>;
  }

  if (customersError || transactionsError) {
    const message =
      (customersErrorMessage instanceof Error && customersErrorMessage.message) ||
      (transactionsErrorMessage instanceof Error && transactionsErrorMessage.message) ||
      'Unknown error';

    return <div className="p-8 text-sm text-destructive">Failed to load M-Pesa data: {message}</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card rounded-xl p-6 shadow-sm animate-fade-up">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-mpesa/10 flex items-center justify-center">
              <Send className="w-4 h-4 text-mpesa" />
            </div>
            <h2 className="text-sm font-semibold text-card-foreground">Send STK Push</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Customer</label>
              <select
                value={selectedCustomerId}
                onChange={(event) => handleCustomerChange(event.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/30"
              >
                <option value="">Select customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} - {c.phone}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="0712345678"
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Amount (KES)</label>
              <input
                type="number"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="2500"
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/30 tabular-nums"
              />
            </div>
            <button
              onClick={handleStkPush}
              disabled={stkPushMutation.isPending || !phone || !amount}
              className={cn(
                'w-full py-2.5 rounded-lg text-sm font-medium transition-all active:scale-[0.97]',
                sent
                  ? 'bg-status-online text-primary-foreground'
                  : 'bg-mpesa text-mpesa-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {stkPushMutation.isPending ? 'Sending STK Push...' : sent ? 'STK Push Sent!' : 'Send M-Pesa STK Push'}
            </button>
            {stkPushMutation.isError && (
              <p className="text-xs text-destructive">
                {stkPushMutation.error instanceof Error ? stkPushMutation.error.message : 'Failed to send STK push'}
              </p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-card rounded-xl shadow-sm overflow-hidden animate-fade-up" style={{ animationDelay: '100ms' }}>
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-card-foreground">Transaction History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Transaction</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Customer</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground">Amount</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Time</th>
                </tr>
              </thead>
              <tbody>
                {mpesaTransactions.map((tx) => {
                  const StatusIcon = tx.status === 'completed' ? CheckCircle : tx.status === 'pending' ? Clock : XCircle;
                  return (
                    <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-mono text-xs text-card-foreground">{tx.transactionId}</p>
                        <p className="text-xs text-muted-foreground">{tx.phone}</p>
                      </td>
                      <td className="px-5 py-3 text-card-foreground">{tx.customerName}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-medium text-card-foreground">KES {tx.amount.toLocaleString()}</td>
                      <td className="px-5 py-3">
                        <span className={cn(
                          'inline-flex items-center gap-1.5 text-xs font-medium',
                          tx.status === 'completed' && 'text-status-online',
                          tx.status === 'pending' && 'text-status-warning',
                          tx.status === 'failed' && 'text-destructive'
                        )}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">{tx.timestamp}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
