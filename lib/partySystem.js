// Monday–Sunday week, matching study_logs.logged_date (a plain date, no timezone)
export function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sun
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMonday));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { start: iso(monday), end: iso(sunday) };
}

export function getBossState(partySize, hoursLogged) {
  const threshold = partySize * 30;
  const percent = threshold > 0 ? Math.min((hoursLogged / threshold) * 100, 100) : 0;
  return {
    threshold,
    hoursLogged,
    hoursRemaining: Math.max(threshold - hoursLogged, 0),
    percent,
    defeated: threshold > 0 && hoursLogged >= threshold,
  };
}
