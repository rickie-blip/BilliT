import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Router,
  Radar,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Wifi,
  Package,
  ReceiptText,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'plans', label: 'Plans', icon: Package },
  { id: 'billing', label: 'Billing', icon: ReceiptText },
  { id: 'routers', label: 'Routers', icon: Router },
  { id: 'detection', label: 'User Detection', icon: Radar },
  { id: 'mpesa', label: 'M-Pesa Payments', icon: Smartphone },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
];

export default function DashboardSidebar({ activePage, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'h-screen sticky top-0 flex flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-out',
        collapsed ? 'w-[68px]' : 'w-[240px]'
      )}
    >
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Wifi className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && <span className="font-semibold text-sidebar-accent-foreground text-sm tracking-tight">NetBill ISP</span>}
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'bg-primary/15 text-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mx-2 mb-4 p-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
