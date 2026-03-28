import http from "node:http";
import https from "node:https";
import { randomUUID } from "node:crypto";
import { getRouterCredentials } from "../config/env.js";
import { formatTimestamp } from "../utils/helpers.js";

const DEFAULT_TIMEOUT_MS = 10_000;

const normalizeCredentialsEnvKey = (value) =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();

const normalizeMacAddress = (value) =>
  String(value || "")
    .trim()
    .replace(/-/g, ":")
    .toUpperCase();

const normalizeIpAddress = (value) => String(value || "").trim();

const buildDetectedUserKey = (routerName, macAddress, ipAddress, detectionMethod) =>
  [
    String(routerName || "").trim().toLowerCase(),
    normalizeMacAddress(macAddress),
    normalizeIpAddress(ipAddress),
    String(detectionMethod || "").trim().toUpperCase(),
  ].join("|");

const buildRouterUserLookupKeys = (routerName, macAddress, ipAddress) =>
  ["PPPoE", "DHCP", "MAC"].map((method) =>
    buildDetectedUserKey(routerName, macAddress, ipAddress, method)
  );

const buildCustomerIndexes = (customers) => {
  const byMac = new Map();
  const byIp = new Map();

  for (const customer of customers) {
    const macAddress = normalizeMacAddress(customer.macAddress);
    const ipAddress = normalizeIpAddress(customer.ipAddress);

    if (macAddress) {
      byMac.set(macAddress, customer);
    }
    if (ipAddress) {
      byIp.set(ipAddress, customer);
    }
  }

  return { byMac, byIp };
};

const findMatchingCustomer = (customerIndexes, macAddress, ipAddress) => {
  const normalizedMac = normalizeMacAddress(macAddress);
  const normalizedIp = normalizeIpAddress(ipAddress);
  return customerIndexes.byMac.get(normalizedMac) || customerIndexes.byIp.get(normalizedIp) || null;
};

const getExistingDetectedUser = (existingUsersByKey, routerName, macAddress, ipAddress) => {
  for (const key of buildRouterUserLookupKeys(routerName, macAddress, ipAddress)) {
    const match = existingUsersByKey.get(key);
    if (match) {
      return match;
    }
  }

  return null;
};

const toHostname = (...values) => {
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return "Unknown Device";
};

const calculateMemoryUsage = (resource) => {
  const total = Number(resource["total-memory"] || resource.totalMemory || 0);
  const free = Number(resource["free-memory"] || resource.freeMemory || 0);
  if (!total || total <= 0) {
    return 0;
  }

  const usedPercentage = ((total - free) / total) * 100;
  return Math.max(0, Math.min(100, Math.round(usedPercentage)));
};

const requestRouterJson = (rawUrl, credentials, allowInsecureTls) =>
  new Promise((resolve, reject) => {
    const url = new URL(rawUrl);
    const transport = url.protocol === "https:" ? https.request : http.request;
    const authHeader = Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64");

    const req = transport(
      url,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${authHeader}`,
        },
        rejectUnauthorized: !(allowInsecureTls && url.protocol === "https:"),
      },
      (res) => {
        const chunks = [];

        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const rawBody = Buffer.concat(chunks).toString("utf-8");
          const statusCode = res.statusCode || 500;

          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(`Router REST request failed with ${statusCode}${rawBody ? `: ${rawBody}` : ""}`));
            return;
          }

          try {
            resolve(rawBody ? JSON.parse(rawBody) : null);
          } catch {
            reject(new Error("Router REST response was not valid JSON"));
          }
        });
      }
    );

    req.setTimeout(DEFAULT_TIMEOUT_MS, () => {
      req.destroy(new Error("Router REST request timed out"));
    });
    req.on("error", reject);
    req.end();
  });

const buildRouterEndpointUrl = (restBaseUrl, endpointPath) => {
  const normalizedBase = String(restBaseUrl || "").trim().replace(/\/+$/, "");
  const normalizedPath = String(endpointPath || "").trim().replace(/^\/+/, "");
  return `${normalizedBase}/rest/${normalizedPath}`;
};

const fetchRouterSnapshot = async (router, credentials) => {
  const [resource, pppActive, dhcpLeases, arpEntries] = await Promise.all([
    requestRouterJson(
      buildRouterEndpointUrl(router.restBaseUrl, "system/resource"),
      credentials,
      router.allowInsecureTls
    ),
    requestRouterJson(
      buildRouterEndpointUrl(router.restBaseUrl, "ppp/active"),
      credentials,
      router.allowInsecureTls
    ),
    requestRouterJson(
      buildRouterEndpointUrl(router.restBaseUrl, "ip/dhcp-server/lease"),
      credentials,
      router.allowInsecureTls
    ),
    requestRouterJson(
      buildRouterEndpointUrl(router.restBaseUrl, "ip/arp"),
      credentials,
      router.allowInsecureTls
    ),
  ]);

  return {
    resource: resource || {},
    pppActive: Array.isArray(pppActive) ? pppActive : [],
    dhcpLeases: Array.isArray(dhcpLeases) ? dhcpLeases : [],
    arpEntries: Array.isArray(arpEntries) ? arpEntries : [],
  };
};

const normalizeRouterUsers = ({ router, snapshot, existingUsersByKey, customerIndexes, syncTimestamp }) => {
  const normalizedByIdentity = new Map();
  const precedence = { PPPoE: 3, DHCP: 2, MAC: 1 };

  const upsertUser = ({ macAddress, ipAddress, hostname, detectionMethod, dataUsage }) => {
    const normalizedMac = normalizeMacAddress(macAddress);
    const normalizedIp = normalizeIpAddress(ipAddress);

    if (!normalizedMac && !normalizedIp) {
      return;
    }

    const identityKey = `${normalizedMac || "nomac"}|${normalizedIp || "noip"}`;
    const existingUser = getExistingDetectedUser(existingUsersByKey, router.name, normalizedMac, normalizedIp);
    const matchedCustomer = findMatchingCustomer(customerIndexes, normalizedMac, normalizedIp);
    const previous = normalizedByIdentity.get(identityKey);

    const candidate = {
      id: previous?.id || existingUser?.id || randomUUID(),
      macAddress: normalizedMac,
      ipAddress: normalizedIp,
      hostname: toHostname(hostname, existingUser?.hostname),
      detectionMethod,
      firstSeen: previous?.firstSeen || existingUser?.firstSeen || syncTimestamp,
      lastSeen: syncTimestamp,
      status: matchedCustomer ? "registered" : "unregistered",
      dataUsage: previous?.dataUsage || existingUser?.dataUsage || String(dataUsage || "Live sync"),
      router: router.name,
      assignedCustomer: matchedCustomer?.name || "",
      source: "live",
    };

    if (!previous || precedence[detectionMethod] >= precedence[previous.detectionMethod]) {
      normalizedByIdentity.set(identityKey, candidate);
    }
  };

  for (const session of snapshot.pppActive) {
    upsertUser({
      macAddress: session["caller-id"] || session.callerId,
      ipAddress: session.address,
      hostname: session.name || session.service,
      detectionMethod: "PPPoE",
      dataUsage: session.uptime || "PPPoE active",
    });
  }

  for (const lease of snapshot.dhcpLeases) {
    upsertUser({
      macAddress: lease["active-mac-address"] || lease["mac-address"] || lease.macAddress,
      ipAddress: lease["active-address"] || lease.address,
      hostname: lease["host-name"] || lease.hostName || lease.comment,
      detectionMethod: "DHCP",
      dataUsage: lease["last-seen"] || lease.lastSeen || "DHCP lease",
    });
  }

  for (const arp of snapshot.arpEntries) {
    upsertUser({
      macAddress: arp["mac-address"] || arp.macAddress,
      ipAddress: arp.address,
      hostname: arp.interface || arp.comment || arp.status,
      detectionMethod: "MAC",
      dataUsage: arp.status || "ARP",
    });
  }

  return Array.from(normalizedByIdentity.values()).sort((left, right) =>
    String(left.hostname).localeCompare(String(right.hostname))
  );
};

const sanitizeSyncMessage = (error) =>
  error instanceof Error ? error.message : "Router sync failed";

const sanitizeRouterStatus = (router, snapshot, detectedUsersCount) => {
  const cpuLoad = Number(snapshot.resource["cpu-load"] || snapshot.resource.cpuLoad || 0);
  const memoryUsage = calculateMemoryUsage(snapshot.resource);

  return {
    ...router,
    uptime: String(snapshot.resource.uptime || router.uptime || "-"),
    cpuLoad,
    memoryUsage,
    connectedUsers: detectedUsersCount,
    status: cpuLoad >= 85 || memoryUsage >= 90 ? "warning" : "online",
  };
};

const shouldSyncRouter = (router) =>
  Boolean(router?.syncEnabled && String(router?.restBaseUrl || "").trim() && String(router?.credentialsKey || "").trim());

export const syncDetectedUsersFromRouters = async (store) => {
  const syncTimestamp = formatTimestamp();
  const customerIndexes = buildCustomerIndexes(store.customers || []);
  const existingUsersByKey = new Map(
    (store.detectedUsers || []).map((user) => [
      buildDetectedUserKey(user.router, user.macAddress, user.ipAddress, user.detectionMethod),
      user,
    ])
  );
  const existingUsersByRouter = new Map();

  for (const user of store.detectedUsers || []) {
    const routerName = String(user.router || "");
    const current = existingUsersByRouter.get(routerName) || [];
    current.push({
      ...user,
      source: user.source || "fallback",
    });
    existingUsersByRouter.set(routerName, current);
  }

  const routerResults = [];
  const syncedUsersByRouter = new Map();
  let anyLiveData = false;

  for (const router of store.routers) {
    if (!shouldSyncRouter(router)) {
      routerResults.push({
        routerId: router.id,
        routerName: router.name,
        status: "skipped",
        message: router.syncEnabled
          ? "Router sync is missing restBaseUrl or credentialsKey"
          : "Router sync is disabled",
        detectedUsersCount: (existingUsersByRouter.get(router.name) || []).length,
        dataSource: "fallback",
        syncedAt: syncTimestamp,
      });
      continue;
    }

    const credentialsEnvKey = normalizeCredentialsEnvKey(router.credentialsKey);
    const credentials = getRouterCredentials(router.credentialsKey);
    if (!credentials) {
      router.lastSyncAt = syncTimestamp;
      router.lastSyncStatus = "failed";
      router.lastSyncMessage = `Missing ROUTER_${credentialsEnvKey}_USERNAME or ROUTER_${credentialsEnvKey}_PASSWORD in backend env`;
      router.status = "warning";
      routerResults.push({
        routerId: router.id,
        routerName: router.name,
        status: "failed",
        message: router.lastSyncMessage,
        detectedUsersCount: (existingUsersByRouter.get(router.name) || []).length,
        dataSource: "fallback",
        syncedAt: syncTimestamp,
      });
      continue;
    }

    try {
      const snapshot = await fetchRouterSnapshot(router, credentials);
      const detectedUsers = normalizeRouterUsers({
        router,
        snapshot,
        existingUsersByKey,
        customerIndexes,
        syncTimestamp,
      });

      syncedUsersByRouter.set(router.name, detectedUsers);
      Object.assign(router, sanitizeRouterStatus(router, snapshot, detectedUsers.length), {
        provider: router.provider || "MikroTik",
        lastSyncAt: syncTimestamp,
        lastSyncStatus: "success",
        lastSyncMessage: `Live sync succeeded with ${detectedUsers.length} detected user${
          detectedUsers.length === 1 ? "" : "s"
        }`,
      });

      routerResults.push({
        routerId: router.id,
        routerName: router.name,
        status: "success",
        message: router.lastSyncMessage,
        detectedUsersCount: detectedUsers.length,
        dataSource: "live",
        syncedAt: syncTimestamp,
      });
      anyLiveData = true;
    } catch (error) {
      const message = sanitizeSyncMessage(error);
      router.lastSyncAt = syncTimestamp;
      router.lastSyncStatus = "failed";
      router.lastSyncMessage = message;
      router.status = "warning";
      routerResults.push({
        routerId: router.id,
        routerName: router.name,
        status: "failed",
        message,
        detectedUsersCount: (existingUsersByRouter.get(router.name) || []).length,
        dataSource: "fallback",
        syncedAt: syncTimestamp,
      });
    }
  }

  const mergedDetectedUsers = [];
  for (const router of store.routers) {
    const liveUsers = syncedUsersByRouter.get(router.name);
    if (liveUsers) {
      mergedDetectedUsers.push(...liveUsers);
      continue;
    }

    const fallbackUsers = existingUsersByRouter.get(router.name) || [];
    mergedDetectedUsers.push(...fallbackUsers.map((user) => ({ ...user, source: user.source || "fallback" })));
  }

  const orphanUsers = (store.detectedUsers || []).filter(
    (user) => !store.routers.some((router) => router.name === user.router)
  );
  mergedDetectedUsers.push(...orphanUsers.map((user) => ({ ...user, source: user.source || "fallback" })));

  store.detectedUsers = mergedDetectedUsers;

  return {
    detectedUsers: store.detectedUsers,
    routers: store.routers,
    routerResults,
    summary: {
      syncedAt: syncTimestamp,
      totalRouters: store.routers.length,
      successfulRouters: routerResults.filter((result) => result.status === "success").length,
      failedRouters: routerResults.filter((result) => result.status === "failed").length,
      skippedRouters: routerResults.filter((result) => result.status === "skipped").length,
      detectedUsers: store.detectedUsers.length,
      usedLiveData: anyLiveData,
      usedFallbackData: routerResults.some((result) => result.dataSource === "fallback"),
    },
  };
};
