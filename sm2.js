// SM-2, the same algorithm the Swift package uses, so a card behaves the same
// whichever side schedules it.
const DAY = 86400000;
const FLOOR = 1.3;

export const GRADES = { again: 0, hard: 3, good: 4, easy: 5 };

export function schedule(state, grade, now = Date.now()) {
  const prev = state ?? { repetitions: 0, intervalDays: 0, easiness: 2.5, lapses: 0 };
  const q = grade;
  const easiness = Math.max(FLOOR, prev.easiness + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  if (q < GRADES.hard) {
    return { repetitions: 0, intervalDays: 1, easiness, lapses: prev.lapses + 1,
             dueDate: now + DAY };
  }
  const repetitions = prev.repetitions + 1;
  const intervalDays = repetitions === 1 ? 1
    : repetitions === 2 ? 6
    : Math.max(1, Math.round(prev.intervalDays * easiness));
  return { repetitions, intervalDays, easiness, lapses: prev.lapses,
           dueDate: now + intervalDays * DAY };
}

export function due(cards, states, now = Date.now(), kind = null) {
  return cards
    .filter(c => kind === null || c.kind === kind)
    .map(c => ({ card: c, state: states[key(c)] ?? null }))
    .filter(({ state }) => state === null || state.dueDate <= now)
    .sort((a, b) => (a.state?.dueDate ?? 0) - (b.state?.dueDate ?? 0));
}

export const key = card => `${card.topicID}:${card.front}`;
