export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  location?: string;
  plan: string;
  monthlyFee: number;
  status: "active" | "suspended" | "expired" | "disabled";
  connectionType: "PPPoE" | "DHCP" | "Static" | "Hotspot";
  macAddress: string;
  ipAddress: string;
  router: string;
  lastPayment: string;
  dueDate: string;
  balance: number;
}

export interface OrganizationSettings {
  companyName: string;
  tradingName: string;
  registrationNumber: string;
  taxPin: string;
  supportEmail: string;
  supportPhone: string;
  address: string;
  website: string;
  invoicePrefix: string;
  billingCycleDay: number;
  gracePeriodDays: number;
  currency: string;
  timezone: string;
  mpesaPaymentType: 'paybill' | 'till' | 'phone' | '';
  mpesaPaybill: string;
  mpesaAccount: string;
  mpesaTill: string;
  mpesaPhone: string;
  smsProvider: string;
  smsSenderId: string;
  emailHost: string;
  emailPort: number;
  emailUser: string;
  emailFrom: string;
  radiusServer: string;
  radiusSecret: string;
  primaryRouter: string;
  notes: string;
}

export interface RouterDevice {
  id: string;
  name: string;
  model: string;
  ipAddress: string;
  status: "online" | "offline" | "warning";
  uptime: string;
  connectedUsers: number;
  cpuLoad: number;
  memoryUsage: number;
  bandwidth: { up: number; down: number };
  location: string;
  apiPort?: number;
  apiUsername?: string;
  apiPassword?: string;
  allowedSourceIp?: string;
  lastConfiguredAt?: string;
  lastConfiguredBy?: string;
  lastCommand?: string;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  downloadMbps: number;
  uploadMbps: number;
  createdAt: string;
}

export interface Invoice {
  id: string;
  customerId: string;
  customerName: string;
  plan: string;
  amount: number;
  dueDate: string;
  status: "paid" | "unpaid";
  period: string;
  createdAt: string;
  paidAt?: string;
}

export interface ReportSummary {
  totalRevenue: number;
  activeCustomers: number;
  inactiveCustomers: number;
  arpu: number;
  activeSessions: number;
  totalInvoices: number;
  unpaidInvoices: number;
}

export interface DetectedUser {
  id: string;
  macAddress: string;
  ipAddress: string;
  hostname: string;
  detectionMethod: "PPPoE" | "DHCP" | "MAC";
  firstSeen: string;
  lastSeen: string;
  status: "registered" | "unregistered";
  dataUsage: string;
  router: string;
  assignedCustomer?: string;
}

export interface MpesaTransaction {
  id: string;
  transactionId: string;
  phone: string;
  amount: number;
  status: "completed" | "pending" | "failed";
  timestamp: string;
  customerName: string;
  accountRef: string;
}

export interface RevenuePoint {
  month: string;
  revenue: number;
  collected: number;
}

export interface DashboardStats {
  activeCustomers: number;
  totalRevenue: number;
  onlineRouters: number;
  totalRouters: number;
  pendingPayments: number;
  outstandingBalance: number;
  hasRouterWarning: boolean;
}

export interface DashboardResponse {
  stats: DashboardStats;
  revenueData: RevenuePoint[];
  recentTransactions: MpesaTransaction[];
}
