export const formatTimestamp = (date = new Date()) =>
  date.toISOString().slice(0, 16).replace("T", " ");

export const nextId = (items) =>
  String(Math.max(0, ...items.map((item) => Number(item.id) || 0)) + 1);
