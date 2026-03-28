import { formatTimestamp, nextId } from "../utils/helpers.js";

// Resolve credentials for a router from env vars.
// credentialsKey on the router record lets each router point to its own env prefix.
// e.g. credentialsKey="ROUTER_MAIN" → ROUTER_MAIN_USER / ROUTER_MAIN_PASS
// Falls back to the router's stored apiUsername/apiPassword when no env key is set.
const resolveCredentials = (router) => {
  const key = router.credentialsKey ? String(router.credentialsKey).toUpperCase() : null;
  if (key) {
    const user = process.env[`${key}_USER`] || process.env[`${key}_USERNAME`] || "";
    const pass = process.env[`${key}_PASS`] || process.env[`${key}_PASSWORD`] || "";
    if (user) return { user, pass };
  }
  return {
    user: router.apiUsername || "",
    pass: router.apiPassword || "",
  };
};

const buildBaseUrl = (router) => {
  if (router.restBaseUrl) return String(router.restBaseUrl).replace(/\/$/, "");
  const proto = router.allowInsecureTls ? "https" : "http";
  const port = router.apiPort || 80;
  return `${proto}://${router.ipAddress}:${port}/rest`;
};

const routerFetch = async (baseUrl, path, credentials, allowInsecure) => {
  const auth = Buffer.from(`${credentials.user}:${credentials.pass}`).toString("base64");
  const url = `${baseUrl}${path}`;

  const fetchOptions = {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(8000),
  };

  // Node 18+ fetch doesn't support rejectUnauthorized natively;
  // for self-signed certs the caller should set NODE_TLS_REJECT_UNAUTHORIZED=0 in env.
  const response = await fetch(url, fetchOptions);
  if (!response.ok) throw new Error(`RouterOS REST ${path} returned ${response.status}`);
  return response.json();
};

const normalizeMac = (mac) =>
  String(mac || "")
    .toLowerCase()
    .replace(/[^0-9a-f]/g, "")
    .replace(/(.{2})(?=.)/g, "$1:")
    .slice(0, 17);

const safeString = (v) => String(v || "").trim();

// Build a detectedUser record from raw RouterOS data
const buildDetectedUser = ({ id, mac, ip, hostname, method, routerName, dataUsage, existing }) => ({
  id,
  macAddress: normalizeMac(mac) || mac,
  ipAddress: safeString(ip),
  hostname: safeString(hostname) || safeString(ip),
  detectionMethod: method,
  firstSeen: existing?.firstSeen || formatTimestamp(),
  lastSeen: formatTimestamp(),
  status: existing?.status || "unregistered",
  dataUsage: dataUsage || existing?.dataUsage || "0 B",
  router: routerName,
  assignedCustomer: existing?.assignedCustomer || "",
});

// Merge live users into the existing store list, preserving manual assignments
const mergeDetectedUsers = (existing, live) => {
  const byMac = new Map(existing.map((u) => [u.macAddress, u]));
  const byIp = new Map(existing.map((u) => [u.ipAddress, u]));
  const seen = new Set();
  const merged = [];

  for (const u of live) {
    const prev = byMac.get(u.macAddress) || byIp.get(u.ipAddress);
    const record = {
      ...u,
      id: prev?.id || u.id,
      firstSeen: prev?.firstSeen || u.firstSeen,
      status: prev?.status || u.status,
      assignedCustomer: prev?.assignedCustomer || u.assignedCustomer,
    };
    merged.push(record);
    seen.add(record.id);
  }

  // Keep existing records that weren't seen in this sync (offline devices)
  for (const u of existing) {
    if (!seen.has(u.id)) merged.push(u);
  }

  return merged;
};

// Match detected users to customers and mark registered
const matchToCustomers = (detectedUsers, customers) => {
  const byMac = new Map(customers.map((c) => [normalizeMac(c.macAddress), c]));
  const byIp = new Map(customers.map((c) => [c.ipAddress, c]));

  return detectedUsers.map((u) => {
    const customer = byMac.get(u.macAddress) || byIp.get(u.ipAddress);
    if (customer) {
      return { ...u, status: "registered", assignedCustomer: customer.name };
    }
    return u;
  });
};

// Sync a single router — returns { routerId, ok, usersFound, message }
export const syncRouter = async (router, store) => {
  const credentials = resolveCredentials(router);
  if (!credentials.user) {
    return { routerId: router.id, ok: false, usersFound: 0, message: "No credentials configured" };
  }

  const baseUrl = buildBaseUrl(router);
  const routerName = router.name;
  const liveUsers = [];
  const idBase = store.detectedUsers;

  try {
    // 1. System resource — update router metadata
    try {
      const resource = await routerFetch(baseUrl, "/system/resource", credentials, router.allowInsecureTls);
      router.uptime = safeString(resource.uptime) || router.uptime;
      router.cpuLoad = Number(resource["cpu-load"]) || router.cpuLoad;
      const totalMem = Number(resource["total-memory"]) || 1;
      const freeMem = Number(resource["free-memory"]) || 0;
      router.memoryUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);
      router.status = "online";
    } catch {
      router.status = "warning";
    }

    // 2. PPPoE active sessions
    try {
      const pppActive = await routerFetch(baseUrl, "/ppp/active", credentials, router.allowInsecureTls);
      for (const session of Array.isArray(pppActive) ? pppActive : []) {
        liveUsers.push(buildDetectedUser({
          id: nextId([...idBase, ...liveUsers]),
          mac: session["caller-id"] || session.name || "",
          ip: session.address || "",
          hostname: session.name || session["caller-id"] || "",
          method: "PPPoE",
          routerName,
          dataUsage: session["bytes-in"] ? `${Math.round(Number(session["bytes-in"]) / 1024)} KB` : "0 B",
          existing: null,
        }));
      }
    } catch {
      // PPPoE endpoint missing — not all routers have it
    }

    // 3. DHCP leases
    try {
      const leases = await routerFetch(baseUrl, "/ip/dhcp-server/lease", credentials, router.allowInsecureTls);
      for (const lease of Array.isArray(leases) ? leases : []) {
        if (lease.status !== "bound") continue;
        liveUsers.push(buildDetectedUser({
          id: nextId([...idBase, ...liveUsers]),
          mac: lease["mac-address"] || "",
          ip: lease.address || "",
          hostname: lease["host-name"] || lease["mac-address"] || "",
          method: "DHCP",
          routerName,
          dataUsage: "0 B",
          existing: null,
        }));
      }
    } catch {
      // DHCP endpoint missing
    }

    // 4. ARP table — fills gaps not covered by PPPoE/DHCP
    try {
      const arp = await routerFetch(baseUrl, "/ip/arp", credentials, router.allowInsecureTls);
      const knownMacs = new Set(liveUsers.map((u) => normalizeMac(u.macAddress)));
      for (const entry of Array.isArray(arp) ? arp : []) {
        if (!entry.address || !entry["mac-address"]) continue;
        if (knownMacs.has(normalizeMac(entry["mac-address"]))) continue;
        liveUsers.push(buildDetectedUser({
          id: nextId([...idBase, ...liveUsers]),
          mac: entry["mac-address"] || "",
          ip: entry.address || "",
          hostname: entry["mac-address"] || "",
          method: "MAC",
          routerName,
          dataUsage: "0 B",
          existing: null,
        }));
      }
    } catch {
      // ARP endpoint missing
    }

    router.lastSyncAt = formatTimestamp();
    router.lastSyncStatus = "ok";
    router.lastSyncMessage = `${liveUsers.length} user(s) found`;

    return { routerId: router.id, ok: true, usersFound: liveUsers.length, message: router.lastSyncMessage, liveUsers };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    router.lastSyncAt = formatTimestamp();
    router.lastSyncStatus = "error";
    router.lastSyncMessage = message;
    router.status = "offline";
    return { routerId: router.id, ok: false, usersFound: 0, message, liveUsers: [] };
  }
};

// Sync all sync-enabled routers and update the store in place
export const syncAllRouters = async (store) => {
  const eligible = store.routers.filter((r) => r.syncEnabled !== false && r.ipAddress);
  if (eligible.length === 0) {
    return { synced: 0, results: [], fallback: true };
  }

  const results = await Promise.all(eligible.map((r) => syncRouter(r, store)));

  const allLive = results.flatMap((r) => r.liveUsers || []);
  if (allLive.length > 0) {
    const merged = mergeDetectedUsers(store.detectedUsers, allLive);
    store.detectedUsers = matchToCustomers(merged, store.customers);
  }

  return {
    synced: results.filter((r) => r.ok).length,
    results: results.map(({ routerId, ok, usersFound, message }) => ({ routerId, ok, usersFound, message })),
    fallback: allLive.length === 0,
  };
};
