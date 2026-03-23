import { formatTimestamp, nextId } from "../utils/helpers.js";

export const appendAuditLog = (store, event) => {
  const row = {
    id: nextId(store.auditLogs),
    timestamp: formatTimestamp(),
    ...event,
  };

  store.auditLogs.unshift(row);
  store.auditLogs = store.auditLogs.slice(0, 1000);
  return row;
};

export const appendRadiusLog = (store, event) => {
  const row = {
    id: nextId(store.radiusAuthLogs),
    timestamp: formatTimestamp(),
    ...event,
  };

  store.radiusAuthLogs.unshift(row);
  store.radiusAuthLogs = store.radiusAuthLogs.slice(0, 1000);
  return row;
};

export const appendRouterActionLog = (store, event) => {
  const row = {
    id: nextId(store.routerActionLogs),
    timestamp: formatTimestamp(),
    ...event,
  };

  store.routerActionLogs.unshift(row);
  store.routerActionLogs = store.routerActionLogs.slice(0, 1000);
  return row;
};
