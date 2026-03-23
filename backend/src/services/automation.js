import { readStore, writeStore } from "../data/store.js";
import { formatTimestamp, nextId } from "../utils/helpers.js";

const todayIso = () => new Date().toISOString().slice(0, 10);

export const runAutomationTick = async () => {
  const store = await readStore();
  let changed = false;

  const today = todayIso();

  for (const customer of store.customers) {
    if (customer.status === "disabled") {
      continue;
    }

    if (customer.dueDate && customer.dueDate < today && Number(customer.balance || 0) > 0) {
      if (customer.status !== "suspended") {
        customer.status = "suspended";
        changed = true;
        store.auditLogs.unshift({
          id: nextId(store.auditLogs),
          timestamp: formatTimestamp(),
          type: "automation.customer.suspended",
          actor: "system",
          customerId: customer.id,
        });
      }
    }

    if (Number(customer.balance || 0) <= 0 && customer.status === "suspended") {
      customer.status = "active";
      changed = true;
      store.auditLogs.unshift({
        id: nextId(store.auditLogs),
        timestamp: formatTimestamp(),
        type: "automation.customer.reactivated",
        actor: "system",
        customerId: customer.id,
      });
    }
  }

  if (changed) {
    store.auditLogs = store.auditLogs.slice(0, 1000);
    await writeStore(store);
  }
};

export const startAutomationJobs = () => {
  runAutomationTick().catch(() => {
    // Ignore background tick errors.
  });

  setInterval(() => {
    runAutomationTick().catch(() => {
      // Ignore background tick errors.
    });
  }, 15 * 60 * 1000);
};
