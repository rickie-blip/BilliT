import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  delay?: number;
}

export default function StatCard({ label, value, change, changeType = 'neutral', icon: Icon, delay = 0 }: StatCardProps) {
  return (
    <div
      className="bg-card rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200 animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-card-foreground mt-1 tabular-nums">{value}</p>
          {change && (
            <p className={cn(
              'text-xs font-medium mt-1',
              changeType === 'positive' && 'text-status-online',
              changeType === 'negative' && 'text-destructive',
              changeType === 'neutral' && 'text-muted-foreground'
            )}>
              {change}
            </p>
          )}
        </div>
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
    </div>
  );
}
