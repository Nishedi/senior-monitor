import { useMqttMonitor } from "./hooks/useMqttMonitor";
import LocationMap from "./components/LocationMap";
import AlertList from "./components/AlertList";
import StatusBar from "./components/StatusBar";

const styles = {
  app: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#f0f4f8",
  },
  header: {
    background: "#1565c0",
    color: "#fff",
    padding: "1rem 1.5rem",
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
  },
  headerTitle: {
    fontSize: "1.25rem",
    fontWeight: 700,
  },
  main: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "1rem",
    padding: "1rem",
    maxWidth: 900,
    width: "100%",
    margin: "0 auto",
  },
  card: {
    background: "#fff",
    borderRadius: 10,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  cardTitle: {
    fontSize: "1rem",
    fontWeight: 600,
    color: "#1e3a5f",
    marginBottom: "0.25rem",
  },
  mapWrapper: {
    height: 360,
  },
  alertsWrapper: {
    maxHeight: 320,
    overflowY: "auto",
  },
  footer: {
    textAlign: "center",
    padding: "0.75rem",
    fontSize: "0.75rem",
    color: "#9ca3af",
  },
};

export default function App() {
  const { connected, location, alerts } = useMqttMonitor();

  const hasPanic = alerts.some((a) => a.type === "panic");
  const hasFall  = alerts.some((a) => a.type === "fall");

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <span style={{ fontSize: "1.5rem" }}>👴</span>
        <span style={styles.headerTitle}>Senior Monitor</span>
        {hasPanic && (
          <span
            style={{
              marginLeft: "auto",
              background: "#dc2626",
              color: "#fff",
              borderRadius: 20,
              padding: "0.2rem 0.75rem",
              fontWeight: 700,
              animation: "pulse 1s infinite",
            }}
          >
            🚨 PANIKA
          </span>
        )}
        {hasFall && !hasPanic && (
          <span
            style={{
              marginLeft: "auto",
              background: "#d97706",
              color: "#fff",
              borderRadius: 20,
              padding: "0.2rem 0.75rem",
              fontWeight: 700,
            }}
          >
            🤸 UPADEK
          </span>
        )}
      </header>

      <main style={styles.main}>
        <StatusBar connected={connected} location={location} />

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>📍 Lokalizacja seniora</h2>
          <div style={styles.mapWrapper}>
            <LocationMap location={location} />
          </div>
          {!location && (
            <p style={{ color: "#9ca3af", fontSize: "0.85rem", textAlign: "center" }}>
              Oczekiwanie na pierwszą lokalizację z urządzenia…
            </p>
          )}
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>⚠️ Alerty ({alerts.length})</h2>
          <div style={styles.alertsWrapper}>
            <AlertList alerts={alerts} />
          </div>
        </div>
      </main>

      <footer style={styles.footer}>
        Senior Monitor &copy; {new Date().getFullYear()}
      </footer>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
