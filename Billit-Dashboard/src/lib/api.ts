import type {
  Customer,
  DashboardResponse,
  DetectedUser,
  Invoice,
  MpesaTransaction,
  Plan,
  ReportSummary,
  RouterDevice,
} from "@/types/domain";

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || "";
const API_BASE_URL = rawBaseUrl.endsWith("/")
  ? rawBaseUrl.slice(0, -1)
  : rawBaseUrl;

const ACCESS_TOKEN_KEY = "billit_access_token";

const toUrl = (path: string) => `${API_BASE_URL}${path}`;

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: "ADMIN" | "STAFF" | "AGENT";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ApiErrorShape {
  message?: string;
}

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export const getAccessToken = (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY);

export const setAccessToken = (token: string) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
};

export const clearAccessToken = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
};

const fetchJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const token = getAccessToken();
  const response = await fetch(toUrl(path), {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    const fallbackMessage = `Request failed with status ${response.status}`;
    let message = fallbackMessage;
    try {
      const body = (await response.json()) as ApiErrorShape;
      if (body.message) {
        message = body.message;
      }
    } catch {
      // Keep fallback message when body is not valid JSON.
    }

    if (response.status === 401) {
      clearAccessToken();
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

export const login = async (payload: { email: string; password: string }) => {
  const data = await fetchJson<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  setAccessToken(data.accessToken);
  return data;
};

export const register = (payload: {
  email: string;
  fullName: string;
  password: string;
  role: "ADMIN" | "STAFF" | "AGENT";
}) =>
  fetchJson<AuthUser>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getCurrentUser = () => fetchJson<AuthUser>("/api/auth/me");

export const logout = () => {
  clearAccessToken();
};

export const getDashboard = () => fetchJson<DashboardResponse>("/api/dashboard");
export const getCustomers = () => fetchJson<Customer[]>("/api/customers");
export const getRouters = () => fetchJson<RouterDevice[]>("/api/routers");
export const getDetectedUsers = () => fetchJson<DetectedUser[]>("/api/detected-users");
export const getMpesaTransactions = () =>
  fetchJson<MpesaTransaction[]>("/api/mpesa/transactions");

export const createRouter = (payload: {
  name: string;
  model: string;
  ipAddress: string;
  location?: string;
  status?: "online" | "warning" | "offline";
  apiPort?: number;
  apiUsername?: string;
  apiPassword?: string;
  allowedSourceIp?: string;
}) =>
  fetchJson<RouterDevice>("/api/routers", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getPlans = () => fetchJson<Plan[]>("/api/plans");
export const getInvoices = () => fetchJson<Invoice[]>("/api/invoices");
export const getReportSummary = () => fetchJson<ReportSummary>("/api/reports/summary");
export const getReportLogs = () =>
  fetchJson<{ auditLogs: unknown[]; routerActionLogs: unknown[]; radiusAuthLogs: unknown[] }>(
    "/api/reports/logs"
  );

export const createPlan = (payload: {
  name: string;
  price: number;
  durationDays: number;
  downloadMbps: number;
  uploadMbps: number;
}) =>
  fetchJson<Plan>("/api/plans", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const generateInvoices = () =>
  fetchJson<{ generatedCount: number; invoices: Invoice[] }>("/api/invoices/generate", {
    method: "POST",
    body: JSON.stringify({}),
  });

export const markInvoicePaid = (invoiceId: string) =>
  fetchJson<Invoice>(`/api/invoices/${invoiceId}/pay`, {
    method: "PATCH",
    body: JSON.stringify({}),
  });

export interface AssignDetectedUserPayload {
  detectedUserId: string;
  customerId: string;
}

export const assignDetectedUser = (payload: AssignDetectedUserPayload) =>
  fetchJson<{ user: DetectedUser; customer: Customer }>(
    `/api/detected-users/${payload.detectedUserId}/assign`,
    {
      method: "PATCH",
      body: JSON.stringify({ customerId: payload.customerId }),
    }
  );

export interface StkPushPayload {
  phone: string;
  amount: number;
  customerId?: string;
}

export const sendStkPush = (payload: StkPushPayload) =>
  fetchJson<MpesaTransaction>("/api/mpesa/stk-push", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export interface ConfigureRouterPayload {
  routerId: string;
  name?: string;
  ipAddress?: string;
  location?: string;
  status?: "online" | "warning" | "offline";
  connectedUsers?: number;
  cpuLoad?: number;
  memoryUsage?: number;
  bandwidthUp?: number;
  bandwidthDown?: number;
  apiPort?: number;
  apiUsername?: string;
  apiPassword?: string;
  allowedSourceIp?: string;
  command?: string;
}

export const configureRouter = (payload: ConfigureRouterPayload) =>
  fetchJson<RouterDevice>(`/api/routers/${payload.routerId}/configure`, {
    method: "PATCH",
    body: JSON.stringify({
      name: payload.name,
      ipAddress: payload.ipAddress,
      location: payload.location,
      status: payload.status,
      connectedUsers: payload.connectedUsers,
      cpuLoad: payload.cpuLoad,
      memoryUsage: payload.memoryUsage,
      bandwidthUp: payload.bandwidthUp,
      bandwidthDown: payload.bandwidthDown,
      apiPort: payload.apiPort,
      apiUsername: payload.apiUsername,
      apiPassword: payload.apiPassword,
      allowedSourceIp: payload.allowedSourceIp,
      command: payload.command,
    }),
  });

export const testRouterConnection = (routerId: string) =>
  fetchJson<{ ok: boolean; message: string }>(`/api/routers/${routerId}/test-connection`, {
    method: "POST",
    body: JSON.stringify({}),
  });

export const getRouterSessions = (routerId: string) =>
  fetchJson<Array<{ username: string; ipAddress: string; sessionTime: string; bandwidthUsage: string }>>(
    `/api/routers/${routerId}/sessions`
  );

export const disconnectRouterUser = (routerId: string, username: string) =>
  fetchJson<{ message: string }>(`/api/routers/${routerId}/disconnect-user`, {
    method: "POST",
    body: JSON.stringify({ username }),
  });
