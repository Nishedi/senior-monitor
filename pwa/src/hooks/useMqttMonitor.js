import { useEffect, useState, useCallback, useRef } from "react";
import mqtt from "mqtt";

/** Mosquitto: listener WebSocket (np. 9001) + protocol websockets */
const MQTT_WS_URL = "ws://72.60.33.184:9001/mqtt";

/** Musi być zgodne z STM_DEVICE_ID / ESP — esp32/main.py */
const DEVICE_ID = "001";

const TOPIC_SUBSCRIBE = `STM_${DEVICE_ID}/#`;

/** Próg |a| (w g) dla alertu „upadek” — surowe ax,ay,az z MPU6050 */
const FALL_TOTAL_ACCEL_G = 2.75;

function espPrefix() {
  return `ESP_${DEVICE_ID}`;
}

/**
 * Payload neo6m z ESP: JSON GGA (lat/lon jako liczby dziesiętne po parsowaniu NMEA).
 */
function locationFromNeo6m(payloadStr) {
  let o;
  try {
    o = JSON.parse(payloadStr);
  } catch {
    return null;
  }
  if (o && o.ok === false) return null;
  if (o.fix != null && String(o.fix) === "0") return null;

  const lat = o.lat;
  const lng = o.lon != null ? o.lon : o.lng;
  if (lat == null || lng == null) return null;

  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;

  return { lat: la, lng: ln, ts: Date.now() };
}

function magnitudeG(ax, ay, az) {
  return Math.sqrt(ax * ax + ay * ay + az * az);
}

export function useMqttMonitor() {
  const [connected, setConnected] = useState(false);
  const [location, setLocation] = useState(null);
  const [alerts, setAlerts] = useState([]);

  const clientRef = useRef(null);
  const lastBtnRef = useRef("1");

  const addAlert = useCallback((alert) => {
    setAlerts((prev) => {
      if (prev.length && prev[0].ts === alert.ts) return prev;
      return [alert, ...prev].slice(0, 50);
    });
  }, []);

  const publish = useCallback((topic, message = "", opts) => {
    const c = clientRef.current;
    if (!c || !c.connected) return false;
    c.publish(topic, message, opts ?? {});
    return true;
  }, []);

  /** Sterowanie jak w firmware: ESP_<id>/red_led/on itd. */
  const publishEsp = useCallback(
    (suffix, payload = "") => publish(`${espPrefix()}${suffix}`, payload),
    [publish],
  );

  useEffect(() => {
    let cancelled = false;
    let client = null;

    /* W dev React 18 Strict Mode montuje efekt dwa razy — pierwszy connect MQTT bywa
       zamykany przed CONNACK („connack timeout”). Opóźnienie + clearTimeout w cleanup
       anuluje pierwszą zaplanowaną próbę; zostaje jedno stabilne połączenie. */
    const connectTimer = setTimeout(() => {
      if (cancelled) return;

      client = mqtt.connect(MQTT_WS_URL, {
        clientId: `web-${Math.random().toString(16).slice(2, 10)}`,
        clean: true,
        reconnectPeriod: 3000,
        connectTimeout: 30_000,
      });

      clientRef.current = client;

      client.on("connect", () => {
        setConnected(true);
        client.subscribe(TOPIC_SUBSCRIBE, (err) => {
          if (err) console.error("MQTT subscribe:", err);
        });
      });

      client.on("close", () => setConnected(false));
      client.on("offline", () => setConnected(false));

      client.on("message", (topic, payloadBuf) => {
        const payloadStr = payloadBuf.toString();
        const ts = Date.now();

        if (topic.endsWith("/neo6m")) {
          const loc = locationFromNeo6m(payloadStr);
          if (loc) setLocation(loc);
          return;
        }

        if (topic.endsWith("/mpu6050")) {
          let d;
          try {
            d = JSON.parse(payloadStr);
          } catch {
            return;
          }
          if (d && d.ok === false) return;
          const ax = Number(d.ax);
          const ay = Number(d.ay);
          const az = Number(d.az);
          if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(az)) return;
          const mag = magnitudeG(ax, ay, az);
          if (mag >= FALL_TOTAL_ACCEL_G) {
            addAlert({ type: "fall", magnitude: mag, ts });
          }
          return;
        }

        if (topic.endsWith("/button")) {
          const v = payloadStr.trim();
          const prev = lastBtnRef.current;
          lastBtnRef.current = v;
          if (v === "0" && prev !== "0") {
            addAlert({ type: "panic", ts });
          }
          return;
        }
      });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(connectTimer);
      clientRef.current = null;
      lastBtnRef.current = "1";
      if (client) {
        client.removeAllListeners();
        client.end(true);
      }
    };
  }, [addAlert]);

  return {
    connected,
    location,
    alerts,
    publish,
    publishEsp,
    espTopicBase: espPrefix(),
  };
}
