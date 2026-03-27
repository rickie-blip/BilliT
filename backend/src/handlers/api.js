import { randomUUID } from "node:crypto";
import { dataFile } from "../config/paths.js";
import { readStore, writeStore } from "../data/store.js";
import {
  getOrganizationSettingsForCompany,
  normalizeCompanyId,
  setOrganizationSettingsForCompany,
} from "../data/settings.js";
import { countUsers, createUser, findUserByEmail, findUserById, listUsers } from "../data/users.js";
import {
  extractBearerToken,
  hashPassword,
  sanitizeUser,
  signAccessToken,
  verifyAccessToken,
  verifyPassword,
} from "../security/auth.js";
import { checkRateLimit } from "../security/rateLimit.js";
import { requireRole } from "../security/rbac.js";
import { appendAuditLog, appendRadiusLog, appendRouterActionLog } from "../services/audit.js";
import { buildDashboardResponse, updateRevenueForCurrentMonth } from "../services/dashboard.js";
import { billingQueue } from "../services/queue.js";
import { sendDarajaStkPush } from "../services/mpesa.js";
import { testRouterTcpConnection } from "../services/router.js";
import { formatTimestamp, hoursBetween, nextId } from "../utils/helpers.js";
import { parsePath, readJsonBody, sendJson } from "../utils/http.js";

const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
};

const resolveAuthUser = async (req) => {
  const token = extractBearerToken(req.headers || {});
  if (!token) {
    return null;
  }

  try {
    const payload = verifyAccessToken(token);
    if (!payload?.sub) {
      return null;
    }

    const user = await findUserById(String(payload.sub));
    if (!user || !user.isActive) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
};

const enforceRole = (res, user, roles) => {
  const permission = requireRole(user, roles);
  if (!permission.ok) {
    sendJson(res, permission.status, { message: permission.message });
    return false;
  }
  return true;
};

const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const currentPeriod = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};



const getRestCatalog = () => ({
  service: "billit-backend",
  style: "REST",
  version: "1.0.0",
  description: "ISP billing and network management API",
  endpoints: [
    { method: "GET", path: "/api", description: "API catalog" },
    { method: "GET", path: "/api/health", description: "Health check" },
    { method: "POST", path: "/api/auth/login", description: "Authenticate and receive a JWT" },
    { method: "POST", path: "/api/auth/register", description: "Create a user" },
    { method: "GET", path: "/api/auth/me", description: "Get current user" },
    { method: "GET", path: "/api/dashboard", description: "Dashboard summary" },
    { method: "GET", path: "/api/customers", description: "List customers" },
    { method: "POST", path: "/api/customers", description: "Create customer" },
    { method: "GET", path: "/api/plans", description: "List plans" },
    { method: "POST", path: "/api/plans", description: "Create plan" },
    { method: "GET", path: "/api/invoices", description: "List invoices" },
    { method: "POST", path: "/api/invoices/generate", description: "Generate invoices for current period" },
    { method: "PATCH", path: "/api/invoices/:id/pay", description: "Mark invoice paid" },
    { method: "GET", path: "/api/routers", description: "List routers" },
    { method: "POST", path: "/api/routers", description: "Create router" },
    { method: "PATCH", path: "/api/routers/:id/configure", description: "Update router settings" },
    { method: "POST", path: "/api/routers/:id/test-connection", description: "Test router TCP connection" },
    { method: "GET", path: "/api/routers/:id/sessions", description: "List routed sessions" },
    { method: "POST", path: "/api/routers/:id/disconnect-user", description: "Queue a disconnect action" },
    { method: "POST", path: "/api/radius/auth", description: "Simulate RADIUS authentication" },
    { method: "GET", path: "/api/radius/logs", description: "List RADIUS logs" },
    { method: "GET", path: "/api/detected-users", description: "List detected users" },
    { method: "PATCH", path: "/api/detected-users/:id/assign", description: "Assign detected user to a customer" },
    { method: "GET", path: "/api/mpesa/transactions", description: "List M-Pesa transactions" },
    { method: "POST", path: "/api/mpesa/stk-push", description: "Initiate a real STK push payment" },
    { method: "POST", path: "/api/mpesa/callback", description: "Safaricom STK callback" },
    { method: "GET", path: "/api/reports/summary", description: "Report summary" },
    { method: "GET", path: "/api/reports/logs", description: "Audit and router logs" },
    { method: "GET", path: "/api/settings", description: "Get company settings" },
    { method: "PATCH", path: "/api/settings", description: "Update company settings" },
  ],
});

const settleMpesaTransaction = async (store, transaction, { resultCode, resultDesc, receiptNumber, callbackTimestamp }) => {
  const alreadySettled = Boolean(transaction.settledAt);
  transaction.resultCode = Number.isFinite(Number(resultCode)) ? Number(resultCode) : resultCode;
  transaction.resultDesc = String(resultDesc || "");
  transaction.receiptNumber = receiptNumber || transaction.receiptNumber || "";
  transaction.gatewayStatus = Number(resultCode) === 0 ? "completed" : "failed";
  transaction.status = Number(resultCode) === 0 ? "completed" : "failed";
  transaction.settledAt = callbackTimestamp;

  if (Number(resultCode) !== 0 || alreadySettled) {
    return;
  }

  updateRevenueForCurrentMonth(store, Number(transaction.amount || 0), true);

  if (transaction.customerId) {
    const customer = store.customers.find((item) => item.id === transaction.customerId);
    if (customer) {
      customer.balance = Math.max(0, Number(customer.balance || 0) - Number(transaction.amount || 0));
      customer.lastPayment = String(callbackTimestamp || transaction.timestamp).split(" ")[0];
      customer.status = customer.balance > 0 ? customer.status : "active";
    }
  }

  appendAuditLog(store, {
    type: "payment.received",
    actor: "system",
    customerId: transaction.customerId || null,
    amount: Number(transaction.amount || 0),
    transactionId: transaction.transactionId,
    resultCode: Number(resultCode),
  });

  try {
    await billingQueue.add("payment-received", {
      customerId: transaction.customerId || null,
      amount: Number(transaction.amount || 0),
      transactionId: transaction.transactionId,
      at: callbackTimestamp || transaction.timestamp,
    });
  } catch {
    // Queue outages should not block payment reconciliation.
  }
};

const generateInvoicesForCurrentPeriod = (store, actorEmail) => {
  const period = currentPeriod();
  const generated = [];

  for (const customer of store.customers) {
    if (customer.status === "disabled") {
      continue;
    }

    const exists = store.invoices.some(
      (invoice) => invoice.customerId === customer.id && invoice.period === period
    );

    if (exists) {
      continue;
    }

    const invoice = {
      id: nextId(store.invoices),
      customerId: customer.id,
      customerName: customer.name,
      plan: customer.plan,
      amount: Number(customer.monthlyFee || 0),
      dueDate: customer.dueDate || formatTimestamp().slice(0, 10),
      status: "unpaid",
      period,
      createdAt: formatTimestamp(),
      paidAt: "",
    };

    store.invoices.unshift(invoice);
    generated.push(invoice);
    appendAuditLog(store, {
      type: "invoice.generated",
      actor: actorEmail,
      customerId: customer.id,
      invoiceId: invoice.id,
      amount: invoice.amount,
    });
  }

  return generated;
};

const resolveCompanyId = (req, actor, url) => {
  const headerValue = req.headers["x-company-id"];
  if (typeof headerValue === "string" && headerValue.trim()) {
    return normalizeCompanyId(headerValue);
  }

  const queryValue = url.searchParams.get("companyId");
  if (queryValue && queryValue.trim()) {
    return normalizeCompanyId(queryValue);
  }

  if (actor?.companyId) {
    return normalizeCompanyId(actor.companyId);
  }

  return "default";
};

export const handleApiRequest = async (req, res) => {
  const method = req.method || "GET";
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const pathParts = parsePath(url.pathname);
  const store = await readStore();

  if (method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  const rateLimitKey = `${getClientIp(req)}:${url.pathname}`;
  const rateLimit = checkRateLimit(rateLimitKey);
  if (!rateLimit.allowed) {
    sendJson(res, 429, {
      message: "Too many requests",
      retryAfterMs: Math.max(0, rateLimit.resetAt - Date.now()),
    });
    return;
  }

  if (url.pathname === "/api" && method === "GET") {
    sendJson(res, 200, getRestCatalog());
    return;
  }

  if (url.pathname === "/api/health" && method === "GET") {
    sendJson(res, 200, { status: "ok", service: "billit-backend", storage: dataFile });
    return;
  }

  if (url.pathname === "/api/auth/register" && method === "POST") {
    const body = await readJsonBody(req);
    if (!body.email || !body.fullName || !body.password || !body.role) {
      sendJson(res, 400, { message: "email, fullName, password and role are required" });
      return;
    }

    const role = String(body.role).toUpperCase();
    if (!["ADMIN", "STAFF", "AGENT"].includes(role)) {
      sendJson(res, 400, { message: "role must be ADMIN, STAFF or AGENT" });
      return;
    }

    const existingUsers = await countUsers();
    const actor = await resolveAuthUser(req);
    if (existingUsers > 0 && !enforceRole(res, actor, ["ADMIN"])) {
      return;
    }

    const existing = await findUserByEmail(String(body.email));
    if (existing) {
      sendJson(res, 409, { message: "User with that email already exists" });
      return;
    }

    const passwordHash = await hashPassword(String(body.password));
    const user = await createUser({
      id: randomUUID(),
      email: String(body.email),
      fullName: String(body.fullName),
      passwordHash,
      role,
      companyId: body.companyId || actor?.companyId || "default",
    });

    appendAuditLog(store, {
      type: "auth.register",
      actor: user.email,
      userId: user.id,
      role: user.role,
      sourceIp: getClientIp(req),
    });
    await writeStore(store);

    sendJson(res, 201, sanitizeUser(user));
    return;
  }

  if (url.pathname === "/api/auth/login" && method === "POST") {
    const body = await readJsonBody(req);
    if (!body.email || !body.password) {
      sendJson(res, 400, { message: "email and password are required" });
      return;
    }

    const user = await findUserByEmail(String(body.email));
    if (!user || !user.isActive) {
      appendAuditLog(store, {
        type: "auth.login.failed",
        actor: String(body.email).toLowerCase(),
        sourceIp: getClientIp(req),
      });
      await writeStore(store);
      sendJson(res, 401, { message: "Invalid credentials" });
      return;
    }

    const validPassword = await verifyPassword(String(body.password), user.passwordHash);
    if (!validPassword) {
      appendAuditLog(store, {
        type: "auth.login.failed",
        actor: user.email,
        userId: user.id,
        sourceIp: getClientIp(req),
      });
      await writeStore(store);
      sendJson(res, 401, { message: "Invalid credentials" });
      return;
    }

    appendAuditLog(store, {
      type: "auth.login.success",
      actor: user.email,
      userId: user.id,
      sourceIp: getClientIp(req),
    });
    await writeStore(store);

    const accessToken = signAccessToken(user);
    sendJson(res, 200, { accessToken, user: sanitizeUser(user) });
    return;
  }

  if (url.pathname === "/api/auth/me" && method === "GET") {
    const user = await resolveAuthUser(req);
    if (!enforceRole(res, user, [])) {
      return;
    }

    sendJson(res, 200, sanitizeUser(user));
    return;
  }

  if (url.pathname === "/api/settings" && method === "GET") {
    const actor = await resolveAuthUser(req);
    if (!enforceRole(res, actor, ["ADMIN"])) {
      return;
    }

    const companyId = resolveCompanyId(req, actor, url);
    sendJson(res, 200, getOrganizationSettingsForCompany(store, companyId));
    return;
  }

  if (url.pathname === "/api/settings" && method === "PATCH") {
    const actor = await resolveAuthUser(req);
    if (!enforceRole(res, actor, ["ADMIN"])) {
      return;
    }

    const body = await readJsonBody(req);
    const companyId = resolveCompanyId(req, actor, url);
    const currentSettings = getOrganizationSettingsForCompany(store, companyId);
    const nextSettings = {
      ...currentSettings,
      ...body,
      companyName: body.companyName !== undefined ? String(body.companyName) : currentSettings.companyName,
      tradingName: body.tradingName !== undefined ? String(body.tradingName) : currentSettings.tradingName,
      registrationNumber: body.registrationNumber !== undefined ? String(body.registrationNumber) : currentSettings.registrationNumber,
      taxPin: body.taxPin !== undefined ? String(body.taxPin) : currentSettings.taxPin,
      supportEmail: body.supportEmail !== undefined ? String(body.supportEmail) : currentSettings.supportEmail,
      supportPhone: body.supportPhone !== undefined ? String(body.supportPhone) : currentSettings.supportPhone,
      address: body.address !== undefined ? String(body.address) : currentSettings.address,
      website: body.website !== undefined ? String(body.website) : currentSettings.website,
      invoicePrefix: body.invoicePrefix !== undefined ? String(body.invoicePrefix) : currentSettings.invoicePrefix,
      billingCycleDay: parseNumber(body.billingCycleDay ?? currentSettings.billingCycleDay, currentSettings.billingCycleDay),
      gracePeriodDays: parseNumber(body.gracePeriodDays ?? currentSettings.gracePeriodDays, currentSettings.gracePeriodDays),
      currency: body.currency !== undefined ? String(body.currency) : currentSettings.currency,
      timezone: body.timezone !== undefined ? String(body.timezone) : currentSettings.timezone,
      mpesaConsumerKey: body.mpesaConsumerKey !== undefined ? String(body.mpesaConsumerKey) : currentSettings.mpesaConsumerKey,
      mpesaConsumerSecret: body.mpesaConsumerSecret !== undefined ? String(body.mpesaConsumerSecret) : currentSettings.mpesaConsumerSecret,
      mpesaShortcode: body.mpesaShortcode !== undefined ? String(body.mpesaShortcode) : currentSettings.mpesaShortcode,
      mpesaPasskey: body.mpesaPasskey !== undefined ? String(body.mpesaPasskey) : currentSettings.mpesaPasskey,
      mpesaCallbackUrl: body.mpesaCallbackUrl !== undefined ? String(body.mpesaCallbackUrl) : currentSettings.mpesaCallbackUrl,
      smsProvider: body.smsProvider !== undefined ? String(body.smsProvider) : currentSettings.smsProvider,
      smsSenderId: body.smsSenderId !== undefined ? String(body.smsSenderId) : currentSettings.smsSenderId,
      emailHost: body.emailHost !== undefined ? String(body.emailHost) : currentSettings.emailHost,
      emailPort: parseNumber(body.emailPort ?? currentSettings.emailPort, currentSettings.emailPort),
      emailUser: body.emailUser !== undefined ? String(body.emailUser) : currentSettings.emailUser,
      emailFrom: body.emailFrom !== undefined ? String(body.emailFrom) : currentSettings.emailFrom,
      radiusServer: body.radiusServer !== undefined ? String(body.radiusServer) : currentSettings.radiusServer,
      radiusSecret: body.radiusSecret !== undefined ? String(body.radiusSecret) : currentSettings.radiusSecret,
      primaryRouter: body.primaryRouter !== undefined ? String(body.primaryRouter) : currentSettings.primaryRouter,
      notes: body.notes !== undefined ? String(body.notes) : currentSettings.notes,
    };

    setOrganizationSettingsForCompany(store, companyId, nextSettings);
    appendAuditLog(store, { type: "settings.updated", actor: actor.email });
    await writeStore(store);
    sendJson(res, 200, nextSettings);
    return;
  }

  if (url.pathname === "/api/users" && method === "GET") {
    const user = await resolveAuthUser(req);
    if (!enforceRole(res, user, ["ADMIN"])) {
      return;
    }

    const users = await listUsers();
    sendJson(res, 200, users.map(sanitizeUser));
    return;
  }

  if (url.pathname === "/api/dashboard" && method === "GET") {
    sendJson(res, 200, buildDashboardResponse(store));
    return;
  }

  if (url.pathname === "/api/reports/summary" && method === "GET") {
    const activeCount = store.customers.filter((customer) => customer.status === "active").length;
    const totalRevenue = store.mpesaTransactions
      .filter((tx) => tx.status === "completed")
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const arpu = activeCount > 0 ? totalRevenue / activeCount : 0;

    sendJson(res, 200, {
      totalRevenue,
      activeCustomers: activeCount,
      inactiveCustomers: store.customers.length - activeCount,
      arpu,
      activeSessions: store.detectedUsers.filter((u) => u.status === "registered").length,
      totalInvoices: store.invoices.length,
      unpaidInvoices: store.invoices.filter((invoice) => invoice.status !== "paid").length,
    });
    return;
  }

  if (url.pathname === "/api/reports/logs" && method === "GET") {
    const actor = await resolveAuthUser(req);
    if (!enforceRole(res, actor, ["ADMIN", "STAFF"])) {
      return;
    }

    sendJson(res, 200, {
      auditLogs: store.auditLogs,
      routerActionLogs: store.routerActionLogs,
      radiusAuthLogs: store.radiusAuthLogs,
    });
    return;
  }

  if (url.pathname === "/api/plans" && method === "GET") {
    sendJson(res, 200, store.plans);
    return;
  }

  if (url.pathname === "/api/plans" && method === "POST") {
    const actor = await resolveAuthUser(req);
    if (!enforceRole(res, actor, ["ADMIN", "STAFF"])) {
      return;
    }

    const body = await readJsonBody(req);
    if (!body.name || !Number.isFinite(Number(body.price)) || !Number.isFinite(Number(body.durationDays))) {
      sendJson(res, 400, { message: "name, price and durationDays are required" });
      return;
    }

    const plan = {
      id: nextId(store.plans),
      name: String(body.name),
      price: Number(body.price),
      durationDays: Number(body.durationDays),
      downloadMbps: parseNumber(body.downloadMbps, 0),
      uploadMbps: parseNumber(body.uploadMbps, 0),
      createdAt: formatTimestamp(),
    };

    store.plans.push(plan);
    appendAuditLog(store, { type: "plan.created", actor: actor.email, planId: plan.id });
    await writeStore(store);
    sendJson(res, 201, plan);
    return;
  }

  if (pathParts[0] === "api" && pathParts[1] === "plans" && pathParts[2] && method === "PATCH") {
    const actor = await resolveAuthUser(req);
    if (!enforceRole(res, actor, ["ADMIN", "STAFF"])) {
      return;
    }

    const plan = store.plans.find((item) => item.id === pathParts[2]);
    if (!plan) {
      sendJson(res, 404, { message: "Plan not found" });
      return;
    }

    const body = await readJsonBody(req);
    if (body.name) plan.name = String(body.name);
    if (body.price !== undefined) plan.price = parseNumber(body.price, plan.price);
    if (body.durationDays !== undefined) plan.durationDays = parseNumber(body.durationDays, plan.durationDays);
    if (body.downloadMbps !== undefined) plan.downloadMbps = parseNumber(body.downloadMbps, plan.downloadMbps);
    if (body.uploadMbps !== undefined) plan.uploadMbps = parseNumber(body.uploadMbps, plan.uploadMbps);

    appendAuditLog(store, { type: "plan.updated", actor: actor.email, planId: plan.id });
    await writeStore(store);
    sendJson(res, 200, plan);
    return;
  }

  if (url.pathname === "/api/customers" && method === "GET") {
    sendJson(res, 200, store.customers);
    return;
  }

  if (url.pathname === "/api/customers" && method === "POST") {
    const actor = await resolveAuthUser(req);
    if (!enforceRole(res, actor, ["ADMIN", "STAFF"])) {
      return;
    }

    const body = await readJsonBody(req);
    if (!body.name || !body.phone || !body.plan || !Number.isFinite(Number(body.monthlyFee))) {
      sendJson(res, 400, { message: "name, phone, plan and monthlyFee are required" });
      return;
    }

    const customer = {
      id: nextId(store.customers),
      name: String(body.name),
      phone: String(body.phone),
      email: String(body.email || ""),
      location: String(body.location || ""),
      plan: String(body.plan),
      monthlyFee: Number(body.monthlyFee),
      status: body.status || "active",
      connectionType: body.connectionType || "DHCP",
      macAddress: body.macAddress || "",
      ipAddress: body.ipAddress || "",
      router: body.router || "",
      lastPayment: body.lastPayment || "",
      dueDate: body.dueDate || "",
      balance: Number(body.balance || 0),
    };

    store.customers.push(customer);
    appendAuditLog(store, { type: "customer.created", actor: actor.email, customerId: customer.id });
    await writeStore(store);
    sendJson(res, 201, customer);
    return;
  }

  if (pathParts[0] === "api" && pathParts[1] === "customers" && pathParts[2] && method === "PATCH") {
    const actor = await resolveAuthUser(req);
    if (!enforceRole(res, actor, ["ADMIN", "STAFF"])) {
      return;
    }

    const customer = store.customers.find((item) => item.id === pathParts[2]);
    if (!customer) {
      sendJson(res, 404, { message: "Customer not found" });
      return;
    }

    const body = await readJsonBody(req);
    Object.assign(customer, body);
    appendAuditLog(store, { type: "customer.updated", actor: actor.email, customerId: customer.id });
    await writeStore(store);
    sendJson(res, 200, customer);
    return;
  }

  if (pathParts[0] === "api" && pathParts[1] === "customers" && pathParts[2] && method === "DELETE") {
    const actor = await resolveAuthUser(req);
    if (!enforceRole(res, actor, ["ADMIN"])) {
      return;
    }

    const initialLength = store.customers.length;
    store.customers = store.customers.filter((item) => item.id !== pathParts[2]);
    if (store.customers.length === initialLength) {
      sendJson(res, 404, { message: "Customer not found" });
      return;
    }

    appendAuditLog(store, { type: "customer.deleted", actor: actor.email, customerId: pathParts[2] });
    await writeStore(store);
    sendJson(res, 204, {});
    return;
  }

  if (url.pathname === "/api/routers" && method === "GET") {
    sendJson(res, 200, store.routers);
    return;
  }

  if (url.pathname === "/api/routers" && method === "POST") {
    const actor = await resolveAuthUser(req);
    if (!enforceRole(res, actor, ["ADMIN", "STAFF"])) {
      return;
    }

    const body = await readJsonBody(req);
    if (!body.name || !body.ipAddress || !body.model) {
      sendJson(res, 400, { message: "name, ipAddress and model are required" });
      return;
    }

    const router = {
      id: nextId(store.routers),
      name: String(body.name),
      model: String(body.model),
      ipAddress: String(body.ipAddress),
      status: String(body.status || "offline").toLowerCase(),
      uptime: body.uptime || "-",
      connectedUsers: parseNumber(body.connectedUsers, 0),
      cpuLoad: parseNumber(body.cpuLoad, 0),
      memoryUsage: parseNumber(body.memoryUsage, 0),
      bandwidth: {
        up: parseNumber(body.bandwidthUp, 0),
        down: parseNumber(body.bandwidthDown, 0),
      },
      location: String(body.location || ""),
      apiPort: parseNumber(body.apiPort, 8728),
      apiUsername: String(body.apiUsername || ""),
      apiPassword: String(body.apiPassword || ""),
      allowedSourceIp: String(body.allowedSourceIp || ""),
    };

    store.routers.push(router);
    appendRouterActionLog(store, { action: "router.added", actor: actor.email, routerId: router.id });
    await writeStore(store);
    sendJson(res, 201, router);
    return;
  }

  if (
    pathParts[0] === "api" &&
    pathParts[1] === "routers" &&
    pathParts[2] &&
    pathParts[3] === "configure" &&
    method === "PATCH"
  ) {
    const actor = await resolveAuthUser(req);
    if (!enforceRole(res, actor, ["ADMIN", "STAFF"])) {
      return;
    }

    const router = store.routers.find((item) => item.id === pathParts[2]);
    if (!router) {
      sendJson(res, 404, { message: "Router not found" });
      return;
    }

    const body = await readJsonBody(req);
    const nextStatus = body.status ? String(body.status).toLowerCase() : router.status;
    if (!["online", "warning", "offline"].includes(nextStatus)) {
      sendJson(res, 400, { message: "status must be online, warning or offline" });
      return;
    }

    router.name = body.name ? String(body.name) : router.name;
    router.ipAddress = body.ipAddress ? String(body.ipAddress) : router.ipAddress;
    router.location = body.location ? String(body.location) : router.location;
    router.status = nextStatus;
    router.connectedUsers = parseNumber(body.connectedUsers, router.connectedUsers);
    router.cpuLoad = parseNumber(body.cpuLoad, router.cpuLoad);
    router.memoryUsage = parseNumber(body.memoryUsage, router.memoryUsage);
    router.bandwidth = {
      up: parseNumber(body.bandwidthUp, router.bandwidth.up),
      down: parseNumber(body.bandwidthDown, router.bandwidth.down),
    };
    router.apiPort = parseNumber(body.apiPort, router.apiPort || 8728);
    router.apiUsername = body.apiUsername !== undefined ? String(body.apiUsername) : router.apiUsername;
    router.apiPassword = body.apiPassword !== undefined ? String(body.apiPassword) : router.apiPassword;
    router.allowedSourceIp = body.allowedSourceIp !== undefined ? String(body.allowedSourceIp) : router.allowedSourceIp;
    router.lastConfiguredAt = formatTimestamp();
    router.lastConfiguredBy = actor.email;
    if (body.command) {
      router.lastCommand = String(body.command);
    }

    appendRouterActionLog(store, {
      action: "router.configured",
      actor: actor.email,
      routerId: router.id,
      command: router.lastCommand || "",
    });
    await writeStore(store);
    sendJson(res, 200, router);
    return;
  }

  if (
    pathParts[0] === "api" &&
    pathParts[1] === "routers" &&
    pathParts[2] &&
    pathParts[3] === "test-connection" &&
    method === "POST"
  ) {
    const actor = await resolveAuthUser(req);
    if (!enforceRole(res, actor, ["ADMIN", "STAFF"])) {
      return;
    }

    const router = store.routers.find((item) => item.id === pathParts[2]);
    if (!router) {
      sendJson(res, 404, { message: "Router not found" });
      return;
    }

    const result = await testRouterTcpConnection({
      host: router.ipAddress,
      port: parseNumber(router.apiPort, 8728),
      timeoutMs: 3000,
    });

    router.status = result.ok ? "online" : "offline";
    appendRouterActionLog(store, {
      action: "router.connection-test",
      actor: actor.email,
      routerId: router.id,
      result: result.ok ? "ok" : "failed",
      message: result.message,
    });
    await writeStore(store);
    sendJson(res, 200, result);
    return;
  }

  if (
    pathParts[0] === "api" &&
    pathParts[1] === "routers" &&
    pathParts[2] &&
    pathParts[3] === "sessions" &&
    method === "GET"
  ) {
    const router = store.routers.find((item) => item.id === pathParts[2]);
    if (!router) {
      sendJson(res, 404, { message: "Router not found" });
      return;
    }

    const sessions = store.detectedUsers
      .filter((user) => user.router === router.name)
      .map((user) => ({
        username: user.assignedCustomer || user.hostname,
        ipAddress: user.ipAddress,
        sessionTime: `${hoursBetween(user.firstSeen || formatTimestamp(), user.lastSeen || formatTimestamp())}h`,
        bandwidthUsage: user.dataUsage,
      }));

    sendJson(res, 200, sessions);
    return;
  }

  if (
    pathParts[0] === "api" &&
    pathParts[1] === "routers" &&
    pathParts[2] &&
    pathParts[3] === "disconnect-user" &&
    method === "POST"
  ) {
    const actor = await resolveAuthUser(req);
    if (!enforceRole(res, actor, ["ADMIN", "STAFF"])) {
      return;
    }

    const router = store.routers.find((item) => item.id === pathParts[2]);
    if (!router) {
      sendJson(res, 404, { message: "Router not found" });
      return;
    }

    const body = await readJsonBody(req);
    if (!body.username) {
      sendJson(res, 400, { message: "username is required" });
      return;
    }

    appendRouterActionLog(store, {
      action: "router.disconnect-user",
      actor: actor.email,
      routerId: router.id,
      username: String(body.username),
    });
    await writeStore(store);
    sendJson(res, 200, { message: `Disconnect command queued for ${String(body.username)}` });
    return;
  }

  if (url.pathname === "/api/radius/auth" && method === "POST") {
    const body = await readJsonBody(req);
    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();

    if (!username || !password) {
      sendJson(res, 400, { message: "username and password are required" });
      return;
    }

    const customer = store.customers.find(
      (row) =>
        String(row.name || "").toLowerCase() === username.toLowerCase() ||
        String(row.phone || "") === username ||
        String(row.email || "").toLowerCase() === username.toLowerCase()
    );

    if (!customer || customer.status !== "active") {
      appendRadiusLog(store, {
        username,
        accepted: false,
        reason: "customer_not_active_or_missing",
      });
      await writeStore(store);
      sendJson(res, 401, { accepted: false, message: "Authentication rejected" });
      return;
    }

    const matchingPlan =
      store.plans.find((plan) => plan.name === customer.plan) ||
      {
        downloadMbps: 10,
        uploadMbps: 10,
        durationDays: 30,
      };

    const attributes = {
      downloadMbps: parseNumber(matchingPlan.downloadMbps, 10),
      uploadMbps: parseNumber(matchingPlan.uploadMbps, 10),
      sessionTimeoutSeconds: parseNumber(matchingPlan.durationDays, 30) * 24 * 60 * 60,
    };

    appendRadiusLog(store, {
      username,
      customerId: customer.id,
      accepted: true,
      attributes,
    });
    await writeStore(store);
    sendJson(res, 200, { accepted: true, attributes });
    return;
  }

  if (url.pathname === "/api/radius/logs" && method === "GET") {
    const actor = await resolveAuthUser(req);
    if (!enforceRole(res, actor, ["ADMIN", "STAFF"])) {
      return;
    }

    sendJson(res, 200, store.radiusAuthLogs);
    return;
  }

  if (url.pathname === "/api/invoices" && method === "GET") {
    sendJson(res, 200, store.invoices);
    return;
  }

  if (url.pathname === "/api/invoices/generate" && method === "POST") {
    const actor = await resolveAuthUser(req);
    if (!enforceRole(res, actor, ["ADMIN", "STAFF"])) {
      return;
    }

    const generated = generateInvoicesForCurrentPeriod(store, actor.email);
    await writeStore(store);
    sendJson(res, 201, { generatedCount: generated.length, invoices: generated });
    return;
  }

  if (pathParts[0] === "api" && pathParts[1] === "invoices" && pathParts[2] && pathParts[3] === "pay" && method === "PATCH") {
    const actor = await resolveAuthUser(req);
    if (!enforceRole(res, actor, ["ADMIN", "STAFF"])) {
      return;
    }

    const invoice = store.invoices.find((row) => row.id === pathParts[2]);
    if (!invoice) {
      sendJson(res, 404, { message: "Invoice not found" });
      return;
    }

    invoice.status = "paid";
    invoice.paidAt = formatTimestamp();

    const customer = store.customers.find((row) => row.id === invoice.customerId);
    if (customer) {
      customer.balance = Math.max(0, Number(customer.balance || 0) - Number(invoice.amount || 0));
      customer.lastPayment = invoice.paidAt.split(" ")[0];
      customer.status = customer.balance > 0 ? customer.status : "active";
    }

    appendAuditLog(store, {
      type: "invoice.paid",
      actor: actor.email,
      invoiceId: invoice.id,
      customerId: invoice.customerId,
      amount: invoice.amount,
    });

    await writeStore(store);
    sendJson(res, 200, invoice);
    return;
  }

  if (url.pathname === "/api/mpesa/callback" && method === "POST") {
    const body = await readJsonBody(req);
    const callback = body?.Body?.stkCallback || body?.stkCallback || body?.Body || body || {};
    const checkoutRequestId = callback.CheckoutRequestID || body?.CheckoutRequestID;
    const merchantRequestId = callback.MerchantRequestID || body?.MerchantRequestID;
    const resultCode = Number(callback.ResultCode ?? body?.ResultCode ?? 1);
    const resultDesc = String(callback.ResultDesc ?? body?.ResultDesc ?? "");
    const metadata = Array.isArray(callback.CallbackMetadata?.Item) ? callback.CallbackMetadata.Item : [];
    const receiptNumber = metadata.find((item) => item?.Name === "MpesaReceiptNumber")?.Value || "";
    const transaction = store.mpesaTransactions.find(
      (item) =>
        (checkoutRequestId && item.checkoutRequestId === checkoutRequestId) ||
        (merchantRequestId && item.merchantRequestId === merchantRequestId)
    );

    if (!transaction) {
      sendJson(res, 404, { message: "Transaction not found" });
      return;
    }

    const callbackTimestamp = formatTimestamp();
    await settleMpesaTransaction(store, transaction, {
      resultCode,
      resultDesc,
      receiptNumber,
      callbackTimestamp,
    });

    await writeStore(store);
    sendJson(res, 200, { message: "Callback processed" });
    return;
  }
  if (url.pathname === "/api/detected-users" && method === "GET") {
    sendJson(res, 200, store.detectedUsers);
    return;
  }

  if (
    pathParts[0] === "api" &&
    pathParts[1] === "detected-users" &&
    pathParts[2] &&
    pathParts[3] === "assign" &&
    method === "PATCH"
  ) {
    const actor = await resolveAuthUser(req);
    if (!enforceRole(res, actor, ["ADMIN", "STAFF"])) {
      return;
    }

    const user = store.detectedUsers.find((item) => item.id === pathParts[2]);
    if (!user) {
      sendJson(res, 404, { message: "Detected user not found" });
      return;
    }

    const body = await readJsonBody(req);
    const customer = store.customers.find((item) => item.id === body.customerId);
    if (!customer) {
      sendJson(res, 400, { message: "Valid customerId is required" });
      return;
    }

    user.status = "registered";
    user.assignedCustomer = customer.name;
    user.lastSeen = formatTimestamp();

    if (!customer.macAddress) customer.macAddress = user.macAddress;
    if (!customer.ipAddress) customer.ipAddress = user.ipAddress;
    if (!customer.router) customer.router = user.router;

    appendRouterActionLog(store, {
      action: "detected-user.assigned",
      actor: actor.email,
      customerId: customer.id,
      detectedUserId: user.id,
      router: user.router,
    });

    await writeStore(store);
    sendJson(res, 200, { user, customer });
    return;
  }

  if (url.pathname === "/api/mpesa/transactions" && method === "GET") {
    sendJson(res, 200, store.mpesaTransactions);
    return;
  }

  if (url.pathname === "/api/mpesa/stk-push" && method === "POST") {
    const actor = await resolveAuthUser(req);
    if (!enforceRole(res, actor, ["ADMIN", "STAFF", "AGENT"])) {
      return;
    }

    const body = await readJsonBody(req);
    const parsedAmount = Number(body.amount);

    if (!body.phone || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      sendJson(res, 400, { message: "phone and amount are required" });
      return;
    }

    const customer = body.customerId
      ? store.customers.find((item) => item.id === body.customerId)
      : null;

    const transaction = {
      id: nextId(store.mpesaTransactions),
      transactionId: `STK${Date.now().toString(36).toUpperCase()}${randomUUID().slice(0, 8).toUpperCase()}`,
      phone: String(body.phone),
      amount: parsedAmount,
      status: "pending",
      timestamp: formatTimestamp(),
      customerId: customer?.id || null,
      customerName: customer?.name || "Unknown Customer",
      accountRef: customer ? `ISP-${customer.id.padStart(3, "0")}` : "ISP-UNK",
      gateway: "daraja",
      gatewayStatus: "initiated",
      receiptNumber: "",
      merchantRequestId: "",
      checkoutRequestId: "",
      resultCode: null,
      resultDesc: "",
      settledAt: "",
    };

    store.mpesaTransactions.unshift(transaction);

    try {
      const darajaResponse = await sendDarajaStkPush({
        amount: parsedAmount,
        phone: body.phone,
        accountReference: transaction.accountRef,
        transactionDesc: body.description || `BillIT invoice for ${transaction.customerName}`,
      });

      transaction.merchantRequestId = darajaResponse?.MerchantRequestID || "";
      transaction.checkoutRequestId = darajaResponse?.CheckoutRequestID || "";
      transaction.gatewayStatus = darajaResponse?.ResponseCode === "0" ? "queued" : "failed";
      transaction.resultDesc = darajaResponse?.ResponseDescription || "";
      transaction.resultCode = darajaResponse?.ResponseCode !== undefined ? Number(darajaResponse.ResponseCode) : null;
      transaction.gatewayResponse = darajaResponse;

      appendAuditLog(store, {
        type: "payment.requested",
        actor: actor.email,
        customerId: customer?.id || null,
        amount: parsedAmount,
        transactionId: transaction.transactionId,
        checkoutRequestId: transaction.checkoutRequestId,
      });

      await writeStore(store);
      sendJson(res, 201, {
        ...transaction,
        message: darajaResponse?.CustomerMessage || "STK push sent",
      });
      return;
    } catch (error) {
      transaction.status = "failed";
      transaction.gatewayStatus = "error";
      transaction.resultDesc = error instanceof Error ? error.message : "STK push failed";
      transaction.settledAt = formatTimestamp();

      appendAuditLog(store, {
        type: "payment.request.failed",
        actor: actor.email,
        customerId: customer?.id || null,
        amount: parsedAmount,
        transactionId: transaction.transactionId,
        error: transaction.resultDesc,
      });

      await writeStore(store);
      sendJson(res, 502, { message: transaction.resultDesc });
      return;
    }
  }

  sendJson(res, 404, { message: "Not found" });
};









