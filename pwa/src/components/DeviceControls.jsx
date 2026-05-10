import { useState } from "react";

const btn = {
  base: {
    padding: "0.5rem 0.85rem",
    borderRadius: 8,
    border: "none",
    fontWeight: 600,
    fontSize: "0.875rem",
    cursor: "pointer",
  },
  red: { background: "#dc2626", color: "#fff" },
  redOff: { background: "#fecaca", color: "#7f1d1d" },
  green: { background: "#16a34a", color: "#fff" },
  greenOff: { background: "#bbf7d0", color: "#14532d" },
  buzz: { background: "#7c3aed", color: "#fff", flex: "1 1 auto" },
};

export default function DeviceControls({ connected, publishEsp }) {
  const [buzzerMs, setBuzzerMs] = useState(500);

  const send = (suffix, payload = "") => {
    if (!connected || !publishEsp(suffix, payload)) {
      return;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <button type="button" style={{ ...btn.base, ...btn.red }} onClick={() => send("/red_led/on")}>
          Czerwona ON
        </button>
        <button type="button" style={{ ...btn.base, ...btn.redOff }} onClick={() => send("/red_led/off")}>
          Czerwona OFF
        </button>
        <button type="button" style={{ ...btn.base, ...btn.green }} onClick={() => send("/green_led/on")}>
          Zielona ON
        </button>
        <button type="button" style={{ ...btn.base, ...btn.greenOff }} onClick={() => send("/green_led/off")}>
          Zielona OFF
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.875rem", color: "var(--body-text)" }}>
          Buzzer (ms)
          <input
            type="number"
            min={0}
            max={60000}
            value={buzzerMs}
            onChange={(e) => setBuzzerMs(Number(e.target.value) || 0)}
            style={{
              width: 100,
              padding: "0.35rem 0.5rem",
              borderRadius: 6,
              border: "1px solid var(--input-border)",
              background: "var(--input-bg)",
              color: "var(--input-text)",
            }}
          />
        </label>
        <button type="button" style={{ ...btn.base, ...btn.buzz }} onClick={() => send("/buzzer", String(buzzerMs))}>
          Wyślij buzzer
        </button>
      </div>

      {!connected && (
        <p style={{ margin: 0, fontSize: "0.8rem", color: "#b91c1c" }}>Brak połączenia z brokerem — sterowanie niedostępne.</p>
      )}
    </div>
  );
}
