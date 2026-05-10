import { useMqttMonitor } from "./hooks/useMqttMonitor";
import { useTheme } from "./hooks/useTheme";
import LocationMap from "./components/LocationMap";
import SensorsPanel from "./components/SensorsPanel";
import DeviceControls from "./components/DeviceControls";
import DevicePicker from "./components/DevicePicker";
import ThemeToggle from "./components/ThemeToggle";

const styles = {
  app: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "var(--app-bg)",
    transition: "background-color 0.2s ease",
  },
  header: {
    background: "var(--header-bg)",
    color: "var(--header-text)",
    padding: "1rem 1.5rem",
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    flexWrap: "wrap",
    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
    transition: "background-color 0.2s ease",
  },
  headerTitle: {
    fontSize: "1.25rem",
    fontWeight: 700,
  },
  headerActions: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    padding: "1rem",
    maxWidth: 1200,
    width: "100%",
    margin: "0 auto",
    boxSizing: "border-box",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
    gap: "1rem",
    alignItems: "stretch",
  },
  card: {
    background: "var(--card-bg)",
    borderRadius: 10,
    boxShadow: "var(--card-shadow)",
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    transition: "background-color 0.2s ease, box-shadow 0.2s ease",
  },
  cardTitle: {
    fontSize: "1rem",
    fontWeight: 600,
    color: "var(--card-title)",
    marginBottom: "0.25rem",
    marginTop: 0,
  },
  mapWrapper: {
    flex: 1,
    minHeight: 320,
  },
  footer: {
    textAlign: "center",
    padding: "0.75rem",
    fontSize: "0.75rem",
    color: "var(--footer-text)",
  },
};

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const {
    connected,
    location,
    telemetry,
    publishEsp,
    deviceIds,
    selectedDeviceId,
    setSelectedDeviceId,
  } = useMqttMonitor();

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <span style={styles.headerTitle}>Senior Monitor</span>
        <div style={styles.headerActions}>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <DevicePicker
            deviceIds={deviceIds}
            selectedDeviceId={selectedDeviceId}
            onSelectDevice={setSelectedDeviceId}
          />
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.row}>
          <div style={{ ...styles.card, display: "flex", flexDirection: "column" }}>
            <h2 style={styles.cardTitle}>Mapa</h2>
            <div style={styles.mapWrapper}>
              <LocationMap location={location} />
            </div>
            <h2 style={{ ...styles.cardTitle, marginTop: "0.25rem" }}>Sterowanie urządzeniem</h2>
            <DeviceControls connected={connected} publishEsp={publishEsp} />
          </div>

          <div style={{ ...styles.card, display: "flex", flexDirection: "column", minHeight: 360 }}>
            <h2 style={styles.cardTitle}>Czujniki</h2>
            <div style={{ overflowY: "auto", flex: 1 }}>
              <SensorsPanel telemetry={telemetry} />
            </div>
          </div>
        </div>
      </main>

      <footer style={styles.footer}>Senior Monitor &copy; {new Date().getFullYear()}</footer>
    </div>
  );
}
