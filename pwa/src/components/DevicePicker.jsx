export default function DevicePicker({
  deviceIds,
  selectedDeviceId,
  onSelectDevice,
}) {
  const options =
    deviceIds.length > 0
      ? deviceIds
      : [selectedDeviceId].filter(Boolean);

  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: "0.9rem",
        fontWeight: 500,
        flexWrap: "wrap",
      }}
    >
      <span style={{ opacity: 0.95 }}>Urządzenie</span>
      <select
        value={selectedDeviceId}
        onChange={(e) => onSelectDevice(e.target.value)}
        style={{
          padding: "0.4rem 0.65rem",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.5)",
          background: "rgba(255,255,255,0.15)",
          color: "#fff",
          minWidth: 140,
          cursor: "pointer",
          fontSize: "0.9rem",
        }}
      >
        {options.map((id) => (
          <option key={id} value={id} style={{ color: "#111" }}>
            ESP32 — {id}
          </option>
        ))}
      </select>
    </label>
  );
}
