                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              export const requireRole = (user, roles = []) => {
  if (!user) {
    return { ok: false, status: 401, message: "Authentication required" };
  }

  if (!roles.length) {
    return { ok: true };
  }

  if (!roles.includes(user.role)) {
    return { ok: false, status: 403, message: "Forbidden" };
  }

  return { ok: true };
};
