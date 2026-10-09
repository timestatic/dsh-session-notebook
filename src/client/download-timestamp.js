/** File suffix in the user's local time: YYYYMMDDHHmmss. */
export function downloadTimestamp(date = new Date()) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())
    || date.getFullYear() < 0 || date.getFullYear() > 9999)
    throw Object.assign(new Error('INVALID_DOWNLOAD_TIME'), { code: 'INVALID_DOWNLOAD_TIME' });
  const pad = (value, width = 2) => String(value).padStart(width, '0');
  return pad(date.getFullYear(), 4) + [date.getMonth() + 1, date.getDate(), date.getHours(),
    date.getMinutes(), date.getSeconds()].map(value => pad(value)).join('');
}
