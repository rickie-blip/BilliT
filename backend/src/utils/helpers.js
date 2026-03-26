const normalizeDateInput = (value) => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string') {
    return new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  }

  return new Date(value);
};

export const formatTimestamp = (date = new Date()) =>
  date.toISOString().slice(0, 16).replace('T', ' ');

export const nextId = (items) =>
  String(Math.max(0, ...items.map((item) => Number(item.id) || 0)) + 1);

export const hoursBetween = (start, end = new Date()) => {
  const startDate = normalizeDateInput(start);
  const endDate = normalizeDateInput(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 1;
  }

  const diffMs = Math.max(0, endDate.getTime() - startDate.getTime());
  return Math.max(1, Math.round(diffMs / (60 * 60 * 1000)));
};

