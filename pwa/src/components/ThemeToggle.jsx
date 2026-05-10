export default function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isDark}
      aria-label={isDark ? "Przełącz na motyw jasny" : "Przełącz na motyw ciemny"}
      title={isDark ? "Motyw jasny" : "Motyw ciemny"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "0.45rem 0.75rem",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.45)",
        background: "rgba(255,255,255,0.12)",
        color: "#fff",
        cursor: "pointer",
        fontSize: "0.85rem",
        fontWeight: 600,
      }}
    >
      <span style={{ fontSize: "1.1rem", lineHeight: 1 }} aria-hidden>
        {isDark ? "☀️" : "🌙"}
      </span>
      <span>{isDark ? "Jasny" : "Ciemny"}</span>
    </button>
  );
}
