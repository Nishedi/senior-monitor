import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";
import { formatMessageAge } from "../utils/relativeMessageAge";
import { useNowTick } from "../hooks/useNowTick";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function Recenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

export default function LocationMap({ location }) {
  useNowTick(250);
  const defaultCenter = [52.2297, 21.0122]; // Warsaw
  const center = location ? [location.lat, location.lng] : defaultCenter;

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ width: "100%", height: "100%", minHeight: 320, borderRadius: 8, overflow: "hidden" }}>
        <MapContainer
          center={center}
          zoom={15}
          style={{ height: "100%", minHeight: 320, width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {location && (
            <>
              <Recenter lat={location.lat} lng={location.lng} />
              <Marker position={[location.lat, location.lng]}>
                <Popup>
                  <strong>Senior</strong>
                  <br />
                  {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  <br />
                  <small>{formatMessageAge(location.ts)}</small>
                </Popup>
              </Marker>
            </>
          )}
        </MapContainer>
      </div>

      <div
        style={{
          marginTop: 10,
          padding: "0.5rem 0.65rem",
          background: "var(--map-footer-bg)",
          borderRadius: 8,
          fontSize: "0.85rem",
          color: "var(--map-footer-text)",
          border: "1px solid var(--map-footer-border)",
          transition: "background-color 0.2s ease, border-color 0.2s ease",
        }}
      >
        {location ? (
          <>
            Ostatnia lokalizacja:{" "}
            <strong>
              {Number(location.lat).toFixed(5)}, {Number(location.lng).toFixed(5)}
            </strong>
            {" · "}
            {formatMessageAge(location.ts)}
          </>
        ) : (
          <span style={{ color: "var(--muted)" }}>
            Brak sygnału GPS - wyświetlanie ostatniej znanej lokalizacji
          </span>
        )}
      </div>
    </div>
  );
}
