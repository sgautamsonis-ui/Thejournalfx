import quotes from "@/data/thoughtOfDayQuotes.json";

// Deterministic "day number" since epoch — same for every user, every device,
// no server/API call needed. Using days-since-epoch (not day-of-year) means
// the rotation doesn't reset or repeat at year boundaries.
function daysSinceEpoch(date) {
  const utcMidnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(utcMidnight / 86400000);
}

// Returns today's quote for each category (risk / discipline / psychology).
// Each category has its own pool size, so the three quotes drift relative to
// each other over time instead of always changing together in lockstep.
export function getThoughtOfTheDay(date = new Date()) {
  const day = daysSinceEpoch(date);
  const pick = (arr) => arr[day % arr.length];
  return {
    risk: pick(quotes.risk),
    discipline: pick(quotes.discipline),
    psychology: pick(quotes.psychology),
  };
}
