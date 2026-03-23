import { Users, DollarSign, Router, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import StatCard from '@/components/StatCard';
import { getDashboard } from '@/lib/api';

export default function OverviewPage() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  });

  if (isPending) {
    return <div className="p-8 text-sm text-muted-foreground">Loading dashboard data...</div>;
  }

  if (isError || !data) {
    return (
      <div className="p-8 text-sm text-destructive">
        Failed to load dashboard data: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  const { stats, revenueData, recentTransactions } = data;

  return (
    <div className="p-8 space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard icon={Users} label="Active Subscribers" value={String(stats.activeCustomers)} change="+3 this month" changeType="positive" delay={0} />
        <StatCard icon={DollarSign} label="Monthly Revenue" value={`KES ${stats.totalRevenue.toLocaleString()}`} change="+8.2% vs last month" changeType="positive" delay={60} />
        <StatCard icon={Router} label="Routers Online" value={`${stats.onlineRouters}/${stats.totalRouters}`} change={stats.hasRouterWarning ? '1 needs attention' : 'All healthy'} changeType={stats.hasRouterWarning ? 'negative' : 'positive'} delay={120} />
        <StatCard icon={AlertTriangle} label="Overdue Accounts" value={String(stats.pendingPayments)} change={`KES ${stats.outstandingBalance.toLocaleString()} outstanding`} changeType="negative" delay={180} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <div className="lg:col-span-2 bg-card rounded-xl p-6 shadow-sm animate-fade-up" style={{ animationDelay: '240ms' }}>
          <h2 className="text-sm font-semibold text-card-foreground mb-4">Revenue vs Collected (KES)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={revenueData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(214 20% 88%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => `KES ${v.toLocaleString()}`} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(214 20% 88%)', fontSize: 13 }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" name="Billed" fill="hsl(168 55% 38%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="collected" name="Collected" fill="hsl(142 60% 42%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent M-Pesa */}
        <div className="bg-card rounded-xl p-6 shadow-sm animate-fade-up" style={{ animationDelay: '300ms' }}>
          <h2 className="text-sm font-semibold text-card-foreground mb-4">Recent M-Pesa Payments</h2>
          <div className="space-y-3">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium text-card-foreground">{tx.customerName}</p>
                  <p className="text-xs text-muted-foreground">{tx.transactionId}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-card-foreground">KES {tx.amount.toLocaleString()}</p>
                  <span className={`text-xs font-medium ${tx.status === 'completed' ? 'text-status-online' : tx.status === 'pending' ? 'text-status-warning' : 'text-destructive'}`}>
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
