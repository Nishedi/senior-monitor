/**
 * LocationMap
 *
 * Renders the senior's latest GPS location on a Leaflet map.
 * Falls back to a placeholder when no location has been received yet.
 */
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";

// Fix the default icon paths broken by Vite's asset pipeline
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/** Re-centres the map whenever the location prop changes. */
function Recenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

export default function LocationMap({ location }) {
  const defaultCenter = [52.2297, 21.0122]; // Warsaw
  const center = location ? [location.lat, location.lng] : defaultCenter;

  return (
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
                <strong>Senio­r</strong>
                <br />
                {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                <br />
                <small>{new Date(location.ts).toLocaleTimeString()}</small>
              </Popup>
            </Marker>
          </>
        )}
      </MapContainer>
    </div>
  );
}
