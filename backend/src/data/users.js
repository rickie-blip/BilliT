import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dataDirectory, seedUsersFile, usersFile } from "../config/paths.js";

const readUsers = async () => {
  const raw = await readFile(usersFile, "utf-8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
};

const writeUsers = async (users) => {
  await writeFile(usersFile, JSON.stringify(users, null, 2), "utf-8");
};

export const ensureUsersStore = async () => {
  await mkdir(dataDirectory, { recursive: true });
  try {
    await access(usersFile);
  } catch {
    const seedRaw = await readFile(seedUsersFile, "utf-8");
    await writeFile(usersFile, seedRaw, "utf-8");
  }
};

export const countUsers = async () => {
  const users = await readUsers();
  return users.length;
};

export const findUserById = async (id) => {
  const users = await readUsers();
  return users.find((user) => user.id === id) || null;
};

export const findUserByEmail = async (email) => {
  const users = await readUsers();
  const normalizedEmail = String(email || "").toLowerCase();
  return users.find((user) => String(user.email).toLowerCase() === normalizedEmail) || null;
};

export const listUsers = async () => {
  const users = await readUsers();
  return users.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
};

export const createUser = async ({ id, email, fullName, passwordHash, role }) => {
  const users = await readUsers();
  const now = new Date().toISOString();
  const user = {
    id,
    email: String(email).toLowerCase(),
    fullName,
    passwordHash,
    role,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  users.push(user);
  await writeUsers(users);
  return user;
};
