/**
 * @param {unknown} value
 * @returns {string|undefined}
 */
export function coerceSunoCreatedAt(value) {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number' && !Number.isNaN(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return undefined;
}

/**
 * @param {Partial<{ sunoCreatedAt?: unknown }>} data
 * @param {Partial<{ sunoCreatedAt?: unknown }>|null|undefined} existing
 * @returns {string|undefined}
 */
export function pickSunoCreatedAt(data, existing) {
  return coerceSunoCreatedAt(data?.sunoCreatedAt) ?? coerceSunoCreatedAt(existing?.sunoCreatedAt);
}
