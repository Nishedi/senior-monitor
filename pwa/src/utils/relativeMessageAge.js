/**
 * Wyświetlanie wieku ostatniej wiadomości względem `now`.
 * - &lt; 1 s: ms
 * - &lt; 1 min: sekundy (2 cyfry znaczące)
 * - &lt; 1 h: pełne minuty
 * - ≥ 1 h: pełna data/godzina (jak locale)
 */
export function formatMessageAge(ts, now = Date.now()) {
  if (ts == null || !Number.isFinite(ts)) return "—";

  const delta = Math.max(0, now - ts);

  if (delta < 1000) {
    return `${Math.round(delta)} ms temu`;
  }

  if (delta < 60_000) {
    const sec = delta / 1000;
    return `${sec.toPrecision(2)} s temu`;
  }

  if (delta < 3600_000) {
    const min = Math.floor(delta / 60_000);
    return `${min} min temu`;
  }

  return new Date(ts).toLocaleString();
}

export function formatMessageAgeInt(ts, now = Date.now()) {
  if (ts == null || !Number.isFinite(ts)) return "—";

  const delta = Math.max(0, now - ts);

  const sec = delta / 1000;
  return sec.toPrecision(2);
}