import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dataDirectory, dataFile, seedDataFile } from "../config/paths.js";

const normalizeStore = (store) => {
  const normalized = { ...store };
  normalized.customers = Array.isArray(store.customers) ? store.customers : [];
  normalized.routers = Array.isArray(store.routers) ? store.routers : [];
  normalized.detectedUsers = Array.isArray(store.detectedUsers) ? store.detectedUsers : [];
  normalized.mpesaTransactions = Array.isArray(store.mpesaTransactions) ? store.mpesaTransactions : [];
  normalized.revenueData = Array.isArray(store.revenueData) ? store.revenueData : [];
  normalized.plans = Array.isArray(store.plans) ? store.plans : [];
  normalized.invoices = Array.isArray(store.invoices) ? store.invoices : [];
  normalized.radiusAuthLogs = Array.isArray(store.radiusAuthLogs) ? store.radiusAuthLogs : [];
  normalized.routerActionLogs = Array.isArray(store.routerActionLogs) ? store.routerActionLogs : [];
  normalized.auditLogs = Array.isArray(store.auditLogs) ? store.auditLogs : [];
  return normalized;
};

export const ensureDataStore = async () => {
  await mkdir(dataDirectory, { recursive: true });
  try {
    await access(dataFile);
  } catch {
    const seedRaw = await readFile(seedDataFile, "utf-8");
    await writeFile(dataFile, seedRaw, "utf-8");
  }
};

export const readStore = async () => {
  const raw = await readFile(dataFile, "utf-8");
  const parsed = JSON.parse(raw);
  return normalizeStore(parsed);
};

export const writeStore = async (store) => {
  await writeFile(dataFile, JSON.stringify(normalizeStore(store), null, 2), "utf-8");
};
