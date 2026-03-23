import { ensureDataStore } from "../backend/src/data/store.js";
import { ensureUsersStore } from "../backend/src/data/users.js";
import { handleApiRequest } from "../backend/src/handlers/api.js";
import { sendJson } from "../backend/src/utils/http.js";

export default async function handler(req, res) {
  try {
    await ensureDataStore();
    await ensureUsersStore();
    await handleApiRequest(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    sendJson(res, 500, { message });
  }
}
