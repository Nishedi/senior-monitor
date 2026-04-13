/**
 * StatusBar
 *
 * Shows connection status and the time of the last location update.
 */
export default function StatusBar({ connected, location }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        background: connected ? "#d1fae5" : "#fee2e2",
        border: `1px solid ${connected ? "#6ee7b7" : "#fca5a5"}`,
        borderRadius: 6,
        padding: "0.5rem 0.75rem",
        fontSize: "0.875rem",
      }}
    >
      <span>{connected ? "🟢 Połączono z serwerem" : "🔴 Brak połączenia – ponawiam…"}</span>
      {location && (
        <span style={{ color: "#374151" }}>
          Ostatnia lokalizacja:{" "}
          <strong>
            {Number(location.lat).toFixed(5)}, {Number(location.lng).toFixed(5)}
          </strong>{" "}
          o {new Date(location.ts).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
