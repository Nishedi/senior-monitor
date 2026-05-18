import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useState } from "react"; // Dodano useState
import { formatMessageAge } from "../utils/relativeMessageAge";
import { useNowTick } from "../hooks/useNowTick";
// Zaimportuj swojego klienta Supabase (popraw ścieżkę jeśli trzeba)
import { supabase } from "../supabaseClient"; 

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

export default function LocationMap({ location, deviceId = "1" }) {
  useNowTick(250);
  const [fallbackLocation, setFallbackLocation] = useState(null);
  const [isLoadingFallback, setIsLoadingFallback] = useState(false);

  const defaultCenter = [51.108806, 17.060472]; // Pwr

  useEffect(() => {
    if (location) {
      setFallbackLocation(null);
      return;
    }

    const fetchLastKnownLocation = async () => {
      setIsLoadingFallback(true);
      try {
        const { data, error } = await supabase
          .from("locations")
          .select("*")
          .eq("device_id", String(deviceId))
          .order("created_at", { ascending: false }) 
          .limit(1); 

        if (error) throw error;

        if (data && data.length > 0) {
          const dbLoc = data[0];
          setFallbackLocation({
            lat: Number(dbLoc.latitude),  
            lng: Number(dbLoc.longitude), 
            ts: new Date(dbLoc.created_at).getTime(), 
          });
        }
      } catch (err) {
        console.error("Błąd pobierania historii lokalizacji:", err.message);
      } finally {
        setIsLoadingFallback(false);
      }
    };

    fetchLastKnownLocation();
  }, [location, deviceId]);

  const activeLocation = location || fallbackLocation;
  const center = activeLocation ? [activeLocation.lat, activeLocation.lng] : defaultCenter;

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

          {activeLocation && (
            <>
              <Recenter lat={activeLocation.lat} lng={activeLocation.lng} />
              <Marker position={[activeLocation.lat, activeLocation.lng]}>
                <Popup>
                  <strong>Senior ({location ? "Sygnał LIVE" : "Archiwalny GPS"})</strong>
                  <br />
                  {activeLocation.lat.toFixed(5)}, {activeLocation.lng.toFixed(5)}
                  <br />
                  <small>{formatMessageAge(activeLocation.ts)}</small>
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
            🟢 Pozycja (LIVE):{" "}
            <strong>
              {Number(location.lat).toFixed(5)}, {Number(location.lng).toFixed(5)}
            </strong>
          </>
        ) : fallbackLocation ? (
          <>
            ⚠️ <span>Brak sygnału GPS · Wyświetlam ostatnią znaną pozycję:</span>{" "}
            <strong>
              {fallbackLocation.lat.toFixed(5)}, {fallbackLocation.lng.toFixed(5)}
            </strong>
            {" · "}
            <small>{formatMessageAge(fallbackLocation.ts)}</small>
          </>
        ) : isLoadingFallback ? (
          <span style={{ color: "var(--muted)" }}>Szukanie ostatniej pozycji w bazie danych...</span>
        ) : (
          <span style={{ color: "var(--muted)" }}>Brak jakichkolwiek danych o lokalizacji seniora.</span>
        )}
      </div>
    </div>
  );
}