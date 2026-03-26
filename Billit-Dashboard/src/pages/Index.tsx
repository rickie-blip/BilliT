import { FormEvent, useEffect, useMemo, useState } from 'react';
import DashboardSidebar from '@/components/DashboardSidebar';
import DashboardHeader from '@/components/DashboardHeader';
import { clearAccessToken, getAccessToken, getCurrentUser, login, logout, register, type AuthUser } from '@/lib/api';
import OverviewPage from './OverviewPage';
import CustomersPage from './CustomersPage';
import PlansPage from './PlansPage';
import BillingPage from './BillingPage';
import RoutersPage from './RoutersPage';
import DetectionPage from './DetectionPage';
import MpesaPage from './MpesaPage';
import ReportsPage from './ReportsPage';
import SettingsPage from './SettingsPage';

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  overview: { title: 'Dashboard', subtitle: 'ISP billing & network overview' },
  customers: { title: 'Customers', subtitle: 'Manage subscribers and billing' },
  plans: { title: 'Service Plans', subtitle: 'Manage plan pricing, duration and speed limits' },
  billing: { title: 'Billing', subtitle: 'Generate invoices and track payment status' },
  routers: { title: 'Router Management', subtitle: 'Monitor and manage network devices' },
  detection: { title: 'User Detection', subtitle: 'PPPoE, DHCP & MAC-based device detection' },
  mpesa: { title: 'M-Pesa Payments', subtitle: 'STK Push & transaction history' },
  reports: { title: 'Reports', subtitle: 'Revenue and operational logs' },
  settings: { title: 'Settings', subtitle: 'Company profile, billing, and payment configuration' },
};

export default function Index() {
  const [activePage, setActivePage] = useState('overview');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'bootstrap'>('login');
  const [email, setEmail] = useState('admin@billit.local');
  const [password, setPassword] = useState('ChangeMe123!');
  const [fullName, setFullName] = useState('Platform Admin');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const meta = pageMeta[activePage];

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setAuthLoading(false);
      return;
    }

    getCurrentUser()
      .then((user) => setCurrentUser(user))
      .catch(() => {
        clearAccessToken();
        setCurrentUser(null);
      })
      .finally(() => setAuthLoading(false));
  }, []);

  const submitText = useMemo(() => {
    if (authSubmitting) {
      return authMode === 'login' ? 'Signing in...' : 'Creating admin...';
    }
    return authMode === 'login' ? 'Sign In' : 'Create First Admin';
  }, [authMode, authSubmitting]);

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthSubmitting(true);
    setAuthError(null);

    try {
      if (authMode === 'bootstrap') {
        await register({
          email,
          fullName,
          password,
          role: 'ADMIN',
        });
      }

      const response = await login({ email, password });
      setCurrentUser(response.user);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
  };

  if (authLoading) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading session...</div>;
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-4">
        <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
          <div>
            <h1 className="text-xl font-semibold text-foreground">BillIT Access</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {authMode === 'login'
                ? 'Sign in to use protected billing and network operations.'
                : 'Use this once to bootstrap the first admin account.'}
            </p>
          </div>

          <div className="flex gap-2 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className={`flex-1 text-sm py-2 rounded-md ${authMode === 'login' ? 'bg-card text-foreground' : 'text-muted-foreground'}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('bootstrap')}
              className={`flex-1 text-sm py-2 rounded-md ${authMode === 'bootstrap' ? 'bg-card text-foreground' : 'text-muted-foreground'}`}
            >
              Bootstrap Admin
            </button>
          </div>

          <form className="space-y-3" onSubmit={handleAuth}>
            {authMode === 'bootstrap' && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Full Name</label>
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  required
                />
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Password</label>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                required
              />
            </div>

            {authError && <p className="text-xs text-destructive">{authError}</p>}

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground disabled:opacity-60"
            >
              {submitText}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar activePage={activePage} onNavigate={setActivePage} />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          title={meta.title}
          subtitle={meta.subtitle}
          currentUserName={currentUser.fullName}
          onLogout={handleLogout}
        />
        <main className="flex-1 overflow-y-auto">
          {activePage === 'overview' && <OverviewPage />}
          {activePage === 'customers' && <CustomersPage />}
          {activePage === 'plans' && <PlansPage />}
          {activePage === 'billing' && <BillingPage />}
          {activePage === 'routers' && <RoutersPage />}
          {activePage === 'detection' && <DetectionPage />}
          {activePage === 'mpesa' && <MpesaPage />}
          {activePage === 'reports' && <ReportsPage />}
          {activePage === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}
