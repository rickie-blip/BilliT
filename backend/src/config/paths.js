import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const isVercel = Boolean(process.env.VERCEL);

export const dataDirectory = isVercel
  ? path.join("/tmp", "billit-data")
  : path.join(projectRoot, "data");

export const dataFile = path.join(dataDirectory, "store.json");
export const seedDataFile = path.join(projectRoot, "data", "seed-store.json");
export const usersFile = path.join(dataDirectory, "users.json");
export const seedUsersFile = path.join(projectRoot, "data", "seed-users.json");
