
import { formatMessageAge, formatMessageAgeInt } from "../utils/relativeMessageAge";
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

export default SimplifiedParams;