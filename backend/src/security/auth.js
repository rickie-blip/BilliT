import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_ACCESS_EXPIRES_IN, JWT_ACCESS_SECRET } from "../config/env.js";

export const hashPassword = async (password) => bcrypt.hash(password, 12);

export const verifyPassword = async (password, hash) => bcrypt.compare(password, hash);

export const signAccessToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId || "default",
    },
    JWT_ACCESS_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRES_IN }
  );

export const verifyAccessToken = (token) => jwt.verify(token, JWT_ACCESS_SECRET);

export const extractBearerToken = (headers) => {
  const authHeader = headers.authorization || headers.Authorization;
  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
};

export const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  role: user.role,
  companyId: user.companyId || "default",
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});
