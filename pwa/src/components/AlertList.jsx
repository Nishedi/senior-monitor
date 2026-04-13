/**
 * AlertList
 *
 * Displays a scrollable list of fall-detection and panic-button alerts.
 */

const ICONS = {
  fall:  "🤸",
  panic: "🚨",
};

const LABELS = {
  fall:  "Upadek wykryty",
  panic: "Przycisk paniki!",
};

const COLORS = {
  fall:  { bg: "#fff3cd", border: "#ffc107", text: "#856404" },
  panic: { bg: "#f8d7da", border: "#f5c2c7", text: "#842029" },
};

export default function AlertList({ alerts }) {
  if (!alerts.length) {
    return (
      <p style={{ color: "#6c757d", textAlign: "center", padding: "1rem" }}>
        Brak alertów – wszystko w porządku 🟢
      </p>
    );
  }

  return (
    <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
      {alerts.map((a, i) => {
        const c = COLORS[a.type] || { bg: "#e2e3e5", border: "#d3d6d8", text: "#383d41" };
        return (
          <li
            key={i}
            style={{
              background: c.bg,
              border: `1px solid ${c.border}`,
              color: c.text,
              borderRadius: 6,
              padding: "0.5rem 0.75rem",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "0.9rem",
            }}
          >
            <span style={{ fontSize: "1.3rem" }}>{ICONS[a.type] ?? "⚠️"}</span>
            <span style={{ flex: 1 }}>
              <strong>{LABELS[a.type] ?? a.type}</strong>
              {a.type === "fall" && a.magnitude != null && (
                <> &mdash; przyspieszenie: <em>{Number(a.magnitude).toFixed(2)}g</em></>
              )}
            </span>
            <span style={{ whiteSpace: "nowrap", opacity: 0.75 }}>
              {new Date(a.ts).toLocaleTimeString()}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
