import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..", "..");
const localEnvPath = path.join(backendRoot, ".env");

const loadLocalEnv = () => {
  if (!existsSync(localEnvPath)) {
    return;
  }

  const raw = readFileSync(localEnvPath, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim().replace(/^["']|["']$/g, "");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
};

loadLocalEnv();

export const PORT = Number(process.env.PORT || 4000);
export const NODE_ENV = process.env.NODE_ENV || "development";

export const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "change-this-secret";
export const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "15m";

export const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
export const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 120);

export const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
export const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
export const REDIS_PASSWORD = process.env.REDIS_PASSWORD || "";

export const MPESA_ENVIRONMENT = process.env.MPESA_ENVIRONMENT || "sandbox";
export const MPESA_CONSUMER_KEY =
  process.env.MPESA_CONSUMER_KEY || process.env["Consumer Key"] || "";
export const MPESA_CONSUMER_SECRET =
  process.env.MPESA_CONSUMER_SECRET || process.env["Consumer Secret"] || "";
export const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE || "";
export const MPESA_PASSKEY = process.env.MPESA_PASSKEY || "";
export const MPESA_CALLBACK_URL = process.env.MPESA_CALLBACK_URL || "";
export const MPESA_BASE_URL =
  process.env.MPESA_BASE_URL ||
  (MPESA_ENVIRONMENT === "sandbox" ? "https://sandbox.safaricom.co.ke" : "https://api.safaricom.co.ke");
