import { formatMessageAge } from "../utils/relativeMessageAge";
import { useNowTick } from "../hooks/useNowTick";

function Card({ title, children, accent = "var(--card-title)" }) {
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
      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: accent, marginBottom: "0.35rem" }}>{title}</div>
      <div style={{ fontSize: "0.85rem", color: "var(--sensor-text)" }}>{children}</div>
    </div>
  );
}

function ErrJson({ parsed }) {
  if (!parsed || parsed.ok !== false) return null;
  return (
    <span style={{ color: "#b91c1c", fontSize: "0.8rem" }}>
      Błąd: {parsed.error}
      {parsed.errno != null ? ` (${parsed.errno})` : ""}
    </span>
  );
}

/** @param {{ ts?: number, raw?: string, parsed?: object | null } | null} entry */
function Neo6mCard({ entry }) {
  if (!entry) return <Card title="NEO-6M (GPS)">Brak danych</Card>;
  const p = entry.parsed;
  if (p && p.ok === false) {
    return (
      <Card title="NEO-6M (GPS)" accent="#b45309">
        <ErrJson parsed={p} />
      </Card>
    );
  }
  if (!p || typeof p !== "object") {
    return (
      <Card title="NEO-6M (GPS)">
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all", fontSize: "0.75rem" }}>{entry.raw}</pre>
      </Card>
    );
  }
  return (
    <Card title="NEO-6M (GPS)">
      <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.15rem 0.75rem", fontSize: "0.8rem" }}>
        <dt style={{ color: "var(--sensor-dt)" }}>Fix / satelity</dt>
        <dd style={{ margin: 0 }}>{p.fix ?? "—"} / {p.sats ?? "—"}</dd>
        <dt style={{ color: "var(--sensor-dt)" }}>HDOP</dt>
        <dd style={{ margin: 0 }}>{p.hdop ?? "—"}</dd>
        <dt style={{ color: "var(--sensor-dt)" }}>Wys. (m)</dt>
        <dd style={{ margin: 0 }}>{p.alt_m ?? "—"}</dd>
        <dt style={{ color: "var(--sensor-dt)" }}>UTC</dt>
        <dd style={{ margin: 0 }}>{p.utc || "—"}</dd>
      </dl>
      <div style={{ marginTop: 6, fontSize: "0.72rem", color: "var(--muted2)" }}>Ostatnia ramka: {formatMessageAge(entry.ts)}</div>
    </Card>
  );
}

function MpuCard({ entry }) {
  if (!entry) return <Card title="MPU6050">Brak danych</Card>;
  const p = entry.parsed;
  if (p && p.ok === false) {
    return (
      <Card title="MPU6050" accent="#b45309">
        <ErrJson parsed={p} />
      </Card>
    );
  }
  if (!p || typeof p !== "object") return <Card title="MPU6050">{entry.raw}</Card>;
  return (
    <Card title="MPU6050 (przyspieszenie / żyro)">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "0.35rem", fontSize: "0.8rem" }}>
        <span>ax: <strong>{p.ax}</strong> g</span>
        <span>ay: <strong>{p.ay}</strong> g</span>
        <span>az: <strong>{p.az}</strong> g</span>
        <span>gx: <strong>{p.gx}</strong></span>
        <span>gy: <strong>{p.gy}</strong></span>
        <span>gz: <strong>{p.gz}</strong></span>
        <span>temp: <strong>{p.temp}</strong> °C</span>
      </div>
      <div style={{ marginTop: 6, fontSize: "0.72rem", color: "var(--muted2)" }}>{formatMessageAge(entry.ts)}</div>
    </Card>
  );
}

function DhtCard({ entry }) {
  if (!entry) return <Card title="DHT11">Brak danych</Card>;
  const p = entry.parsed;
  if (p && p.ok === false) {
    return (
      <Card title="DHT11" accent="#b45309">
        <ErrJson parsed={p} />
      </Card>
    );
  }
  if (p && typeof p === "object" && "temp" in p) {
    return (
      <Card title="DHT11">
        Temperatura: <strong>{p.temp}</strong> °C, wilgotność: <strong>{p.hum}</strong> %
        <div style={{ marginTop: 6, fontSize: "0.72rem", color: "var(--muted2)" }}>{formatMessageAge(entry.ts)}</div>
      </Card>
    );
  }
  return <Card title="DHT11">{entry.raw}</Card>;
}

function Ky037Card({ entry }) {
  if (!entry) return <Card title="KY-037">Brak danych</Card>;
  const p = entry.parsed;
  if (p && p.ok === false) {
    return (
      <Card title="KY-037" accent="#b45309">
        <ErrJson parsed={p} />
      </Card>
    );
  }
  const raw = p?.raw ?? entry.raw;
  return (
    <Card title="KY-037 (mikrofon / ADC)">
      Surowy ADC: <strong>{raw}</strong>
      <div style={{ marginTop: 6, fontSize: "0.72rem", color: "var(--muted2)" }}>{formatMessageAge(entry.ts)}</div>
    </Card>
  );
}

function BinaryPinCard({ title, entry, labels }) {
  if (!entry) return <Card title={title}>Brak danych</Card>;
  const p = entry.parsed;
  if (p && p.ok === false) {
    return (
      <Card title={title} accent="#b45309">
        <ErrJson parsed={p} />
      </Card>
    );
  }
  const v = (entry.raw ?? "").trim();
  const active = v === "0";
  return (
    <Card title={title}>
      Stan:{" "}
      <strong style={{ color: active ? "#dc2626" : "#16a34a" }}>
        {active ? labels.active : labels.idle}
      </strong>{" "}
      ({v})
      <div style={{ marginTop: 6, fontSize: "0.72rem", color: "var(--muted2)" }}>{formatMessageAge(entry.ts)}</div>
    </Card>
  );
}

function max30102LatestTs(bpm, spo2) {
  const a = bpm?.ts;
  const b = spo2?.ts;
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return Math.max(a, b);
}

/** Jedna sonda — bez wyświetlania ROM/suffixu w UI. */
function Ds18b20Card({ probes }) {
  if (!probes.length) return null;
  const latest = probes.reduce((best, row) =>
    row[1].ts > best[1].ts ? row : best,
  probes[0]);
  const [, e] = latest;
  const p = e.parsed;
  let display = e.raw;
  if (typeof p === "number" && Number.isFinite(p)) display = `${p.toFixed(2)} °C`;
  else if (p && p.ok === false) display = `błąd: ${p.error}`;
  else if (p && typeof p === "object") display = JSON.stringify(p);

  return (
    <Card title="DS18B20 (temperatura 1-wire)">
      <div>
        Temperatura: <strong>{display}</strong>
      </div>
      <div style={{ marginTop: 6, fontSize: "0.72rem", color: "var(--muted2)" }}>
        {formatMessageAge(e.ts)}
      </div>
    </Card>
  );
}

function Max30102Card({ bpm, spo2 }) {
  const fmt = (entry) => {
    if (!entry) return "—";
    const p = entry.parsed;
    if (p && p.ok === false) return `błąd: ${p.error}`;
    return entry.raw?.trim() ?? "—";
  };

  const latestTs = max30102LatestTs(bpm, spo2);

  return (
    <Card title="MAX30102 (tętno / SpO₂)">
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div>
          BPM: <strong>{fmt(bpm)}</strong>
        </div>
        <div>
          SpO₂: <strong>{fmt(spo2)}</strong>
        </div>
      </div>
      {latestTs != null && (
        <div style={{ marginTop: 6, fontSize: "0.72rem", color: "var(--muted2)" }}>
          {formatMessageAge(latestTs)}
        </div>
      )}
    </Card>
  );
}

export default function SensorsPanel({ telemetry }) {
  useNowTick(250);
  const probes = telemetry.ds18b20 ? Object.entries(telemetry.ds18b20) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "0.65rem",
        }}
      >
        <Neo6mCard entry={telemetry.neo6m} />
        <MpuCard entry={telemetry.mpu6050} />
        <DhtCard entry={telemetry.dht11} />
        <Ky037Card entry={telemetry.ky037} />
        <BinaryPinCard
          title="SW-520D (nachylenie)"
          entry={telemetry.sw520d}
          labels={{ active: "aktywny", idle: "spoczynek" }}
        />
        <BinaryPinCard
          title="Przycisk"
          entry={telemetry.button}
          labels={{ active: "wciśnięty", idle: "zwolniony" }}
        />
        <div
          style={{
            gridColumn: "1 / -1",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
            gap: "0.65rem",
            alignItems: "stretch",
          }}
        >
          <Max30102Card bpm={telemetry.max30102_bpm} spo2={telemetry.max30102_spo2} />
          <Ds18b20Card probes={probes} />
        </div>
      </div>
    </div>
  );
}
