/**
 * useMonitorSocket
 *
 * Connects to the backend WebSocket and maintains the monitor state:
 *   - location  : latest GPS fix
 *   - alerts    : history of fall / panic events
 *   - connected : connection status
 */
import { useEffect, useRef, useState, useCallback } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3001";
const RECONNECT_DELAY_MS = 3000;

export function useMonitorSocket() {
  const [connected, setConnected] = useState(false);
  const [location, setLocation] = useState(null);   // { lat, lng, ts }
  const [alerts, setAlerts] = useState([]);          // [{ type, ts, ... }]
  const wsRef = useRef(null);
  const timerRef = useRef(null);

  const addAlert = useCallback((alert) => {
    setAlerts((prev) => {
      // Deduplicate by ts
      if (prev.length && prev[0].ts === alert.ts) return prev;
      return [alert, ...prev].slice(0, 50);
    });
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState < 2) return; // already open/connecting

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      clearTimeout(timerRef.current);
    };

    ws.onmessage = (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch { return; }

      switch (data.type) {
        case "state_snapshot":
          if (data.location) setLocation(data.location);
          if (Array.isArray(data.alerts)) setAlerts(data.alerts);
          break;

        case "location":
          setLocation({ lat: data.lat, lng: data.lng, ts: data.ts });
          break;

        case "accelerometer":
          if (data.fall) addAlert({ type: "fall", magnitude: data.magnitude, ts: data.ts });
          break;

        case "panic":
          addAlert({ type: "panic", ts: data.ts });
          break;

        default:
          break;
      }
    };

    ws.onclose = () => {
      setConnected(false);
      timerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [addAlert]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(timerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return { connected, location, alerts };
}
