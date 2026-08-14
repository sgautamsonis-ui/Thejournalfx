// Trade times are stored as simple HH:MM values. This helper only changes the
// display style; it deliberately never shifts a recorded trade into a new timezone.
export function formatTradeTime(value, format = "12h") {
  if (!value) return "—";
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return value;
  let hour = Number(match[1]);
  const minute = match[2];
  if (format === "24h") return `${String(hour).padStart(2, "0")}:${minute}`;
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
}
