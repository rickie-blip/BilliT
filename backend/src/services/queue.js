import { Queue } from "bullmq";
import { REDIS_HOST, REDIS_PASSWORD, REDIS_PORT } from "../config/env.js";

const connection = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  ...(REDIS_PASSWORD ? { password: REDIS_PASSWORD } : {}),
};

export const billingQueue = new Queue("billing", { connection });
export const notificationQueue = new Queue("notifications", { connection });
export const routerSyncQueue = new Queue("router-sync", { connection });
