import { useMqttMonitor } from "./hooks/useMqttMonitor";
import { useTheme } from "./hooks/useTheme";
import { useMode } from "./hooks/useMode";
import LocationMap from "./components/LocationMap";
import SensorsPanel from "./components/SensorsPanel";
import DeviceControls from "./components/DeviceControls";
import DevicePicker from "./components/DevicePicker";
import ThemeToggle from "./components/ThemeToggle";
import AdminToggle from "./components/AdminToggle";
import { formatMessageAge, formatMessageAgeInt } from "./utils/relativeMessageAge";

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

function SimplifiedParams({ bpm, spo2, probes }) {
  function lastUpdateLatestTs(bpm, spo2, temperature) {
    const a = bpm?.ts;
    const b = spo2?.ts;
    const c = temperature?.ts;
    if (a == null && b == null && c == null) return null;
    if (a == null) return Math.max(b, c);
    if (b == null) return Math.max(a, c);
    if (c == null) return Math.max(a, b);

    return Math.max(a, b);
  }


  let display = "—";
  if (probes.length){
    const latest = probes.reduce((best, row) =>
      row[1].ts > best[1].ts ? row : best,
    probes[0]);
    const [, e] = latest;
    const p = e.parsed;
    display = e.raw;
  }
  
  const fmt = (entry) => {
      if (!entry) return "—";
      const p = entry.parsed;
      if (p && p.ok === false) return `błąd: ${p.error}`;
      return entry.raw?.trim() ?? "—";
    };
  const latestTs = lastUpdateLatestTs(bpm, spo2, display);
  const PulseStyle = (bpm) => {
    if (bpm < 50 || bpm > 150) {
      return { color: '#dc3545', fontSize: '1.3rem', fontWeight: 'bold' };
    }
    if ((bpm >= 50 && bpm < 60) || (bpm > 100 && bpm <= 150)) {
      return { color: '#d9c006', fontSize: '1.15rem' };
    }
    return {};
  };
  const SaturationStyle = (spo2) => {
    if (spo2 < 90) {
      return { color: '#dc3545', fontSize: '1.3rem', fontWeight: 'bold' };
    }
    if (spo2 >= 90 && spo2 < 95) {
      return { color: '#d9c006', fontSize: '1.15rem' };
    }
    return {};
  };
  const TemperatureStyle = (temp) => {
    if (temp < 30 || temp > 40) {
      return { color: '#dc3545', fontSize: '1.3rem', fontWeight: 'bold' };
    }
    if ((temp >= 38 && temp < 35.5) || (temp > 37.5 && temp <= 38)) {
      return { color: '#d9c006', fontSize: '1.15rem' };
    }
    return {};
  };

  return (
    <div
      style={{
        border: "1px solid var(--sensor-card-border)",
        borderRadius: 8,
        padding: "0.65rem 0.75rem",
        background: "var(--sensor-card-bg)",
        transition: "background-color 0.2s ease, border-color 0.2s ease",
      }}
    >
      <div style={{ fontSize: "1.1rem", fontWeight: 700,  marginBottom: "0.35rem" }}>Parametry życiowe</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={PulseStyle(fmt(bpm))}>
          Tętno: <strong>{fmt(bpm)}</strong>
        </div>
        <div style={SaturationStyle(fmt(spo2))}>
          Saturacja: <strong>{fmt(spo2)}</strong>
        </div>
        <div style={TemperatureStyle(display)}>

          Temperatura ciała: <strong>{display} °C</strong>
        </div>
      </div>
      {latestTs != null  && formatMessageAgeInt(latestTs) > 10 && (
        
        <div style={{ marginTop: 6, fontSize: "0.72rem", color: "var(--muted2)" }}>
          Ostatnia aktualzacja: {formatMessageAge(latestTs)} sekund temu
          
        </div>
      )}
    </div>
  );
}


export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { mode, toggleMode } = useMode(); 
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
          {mode === "admin" && (
            <DevicePicker
              deviceIds={deviceIds}
              selectedDeviceId={selectedDeviceId}
              onSelectDevice={setSelectedDeviceId}
            />
          )}
          
          <AdminToggle mode={mode} onToggle={toggleMode} />
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.row}>
          <div style={{ ...styles.card, display: "flex", flexDirection: "column" }}>
            <h2 style={styles.cardTitle}>Mapa</h2>
            <div style={styles.mapWrapper}>
              <LocationMap location={location} />
            </div>
            {mode === "admin" && (
              <>
                <h2 style={{ ...styles.cardTitle, marginTop: "0.25rem" }}>Sterowanie urządzeniem</h2>
                <DeviceControls connected={connected} publishEsp={publishEsp} />
              </>
            )}
          </div>
          {mode === "admin" ? (
          <div style={{ ...styles.card, display: "flex", flexDirection: "column", minHeight: 360 }}>
            <h2 style={styles.cardTitle}>Czujniki</h2>
            <div style={{ overflowY: "auto", flex: 1 }}>
              <SensorsPanel telemetry={telemetry} mode={mode}/>
            </div>
          </div>):(
            SimplifiedParams({ bpm: telemetry.max30102_bpm, spo2: telemetry.max30102_spo2, probes: telemetry.ds18b20 ? Object.entries(telemetry.ds18b20) : [] })
          )}
        </div>
      </main>

      <footer style={styles.footer}>Senior Monitor &copy; {new Date().getFullYear()}</footer>
    </div>
  );
}
