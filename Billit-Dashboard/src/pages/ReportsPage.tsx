import { useQuery } from '@tanstack/react-query';
import { getReportLogs, getReportSummary } from '@/lib/api';

export default function ReportsPage() {
  const summaryQuery = useQuery({ queryKey: ['reports-summary'], queryFn: getReportSummary });
  const logsQuery = useQuery({ queryKey: ['reports-logs'], queryFn: getReportLogs });

  if (summaryQuery.isLoading || logsQuery.isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading reports...</div>;
  }

  if (summaryQuery.isError || logsQuery.isError || !summaryQuery.data || !logsQuery.data) {
    return <div className="p-8 text-sm text-destructive">Failed to load report data.</div>;
  }

  const summary = summaryQuery.data;
  const { auditLogs, routerActionLogs, radiusAuthLogs } = logsQuery.data;

  return (
    <div className="p-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Total Revenue</p>
          <p className="text-xl font-semibold">KES {summary.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Active / Inactive Customers</p>
          <p className="text-xl font-semibold">{summary.activeCustomers} / {summary.inactiveCustomers}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">ARPU</p>
          <p className="text-xl font-semibold">KES {summary.arpu.toFixed(2)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ReportLogCard title="Audit Logs" rows={auditLogs} />
        <ReportLogCard title="Router Action Logs" rows={routerActionLogs} />
        <ReportLogCard title="RADIUS Auth Logs" rows={radiusAuthLogs} />
      </div>
    </div>
  );
}

function ReportLogCard({ title, rows }: { title: string; rows: unknown[] }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      <div className="space-y-2 max-h-80 overflow-y-auto text-xs">
        {rows.slice(0, 50).map((row, index) => (
          <pre key={index} className="bg-muted/40 rounded-md p-2 whitespace-pre-wrap break-words">
            {JSON.stringify(row, null, 2)}
          </pre>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground">No records.</p>}
      </div>
    </div>
  );
}
