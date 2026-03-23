import { Bell, LogOut, Search } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  currentUserName: string;
  onLogout: () => void;
}

export default function DashboardHeader({ title, subtitle, currentUserName, onLogout }: HeaderProps) {
  const initial = currentUserName.trim().charAt(0).toUpperCase() || 'U';

  return (
    <header className="flex items-center justify-between px-8 h-16 border-b border-border bg-card">
      <div>
        <h1 className="text-lg font-semibold text-foreground leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring/30 w-56"
          />
        </div>
        <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors" type="button">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive" />
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="p-2 rounded-lg hover:bg-secondary transition-colors"
          title="Logout"
        >
          <LogOut className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
          {initial}
        </div>
      </div>
    </header>
  );
}
