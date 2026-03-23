import { createServer } from "node:http";
import { PORT } from "./config/env.js";
import { dataFile, usersFile } from "./config/paths.js";
import { ensureDataStore } from "./data/store.js";
import { ensureUsersStore } from "./data/users.js";
import { handleApiRequest } from "./handlers/api.js";
import { startAutomationJobs } from "./services/automation.js";
import { sendJson } from "./utils/http.js";

export const startServer = async () => {
  await ensureDataStore();
  await ensureUsersStore();

  startAutomationJobs();

  const server = createServer(async (req, res) => {
    try {
      await handleApiRequest(req, res);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal server error";
      sendJson(res, 500, { message });
    }
  });

  server.listen(PORT, () => {
    console.log(`BillIT backend running on http://localhost:${PORT}`);
    console.log(`Store data file: ${dataFile}`);
    console.log(`Users data file: ${usersFile}`);
  });

  return server;
};
