import { useEffect, useState, useCallback, useRef } from "react";
import mqtt from "mqtt";

/** Mosquitto: listener WebSocket (np. 9001) + protocol websockets */
const MQTT_WS_URL = "ws://72.60.33.184:9001/mqtt";

/** Wszystkie urządzenia: pierwszy segment `STM_001/…` lub `ESP_001/…` */
const TOPIC_SUBSCRIBE = "+/+/#";

const LS_DEVICE_KEY = "senior-monitor-device-id";

/** Tematy pojedynczych czujników (bez dynamicznych ds18b20_<rom>) */
const SINGLE_SENSORS = new Set([
  "neo6m",
  "mpu6050",
  "dht11",
  "ky037",
  "sw520d",
  "button",
  "max30102_bpm",
  "max30102_spo2",
]);

function safeJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function firstSegment(topic) {
  const i = topic.indexOf("/");
  return i === -1 ? topic : topic.slice(0, i);
}

/** Zwraca id urządzenia (np. "001") z pierwszego segmentu STM_001 / ESP_001 */
function deviceIdFromTopic(topic) {
  const seg = firstSegment(topic);
  const m = seg.match(/^(STM|ESP)_(.+)$/);
  return m ? m[2] : null;
}

function stmPrefix(deviceId) {
  return `STM_${deviceId}/`;
}

function espPrefix(deviceId) {
  return `ESP_${deviceId}`;
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

function createEmptyTelemetry() {
  return {
    neo6m: null,
    mpu6050: null,
    dht11: null,
    ky037: null,
    sw520d: null,
    button: null,
    max30102_bpm: null,
    max30102_spo2: null,
    ds18b20: {},
  };
}

export function useMqttMonitor() {
  const [connected, setConnected] = useState(false);
  const [location, setLocation] = useState(null);
  const [telemetry, setTelemetry] = useState(() => createEmptyTelemetry());
  const [deviceIds, setDeviceIds] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(() => {
    try {
      return localStorage.getItem(LS_DEVICE_KEY) || "001";
    } catch {
      return "001";
    }
  });

  const clientRef = useRef(null);
  const selectedRef = useRef(selectedDeviceId);
  selectedRef.current = selectedDeviceId;

  useEffect(() => {
    try {
      localStorage.setItem(LS_DEVICE_KEY, selectedDeviceId);
    } catch {
      /* ignore */
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    setTelemetry(createEmptyTelemetry());
    setLocation(null);
  }, [selectedDeviceId]);

  const publish = useCallback((topic, message = "", opts) => {
    const c = clientRef.current;
    if (!c || !c.connected) return false;
    c.publish(topic, message, opts ?? {});
    return true;
  }, []);

  const publishEsp = useCallback(
    (suffix, payload = "") =>
      publish(`${espPrefix(selectedDeviceId)}${suffix}`, payload),
    [publish, selectedDeviceId],
  );

  useEffect(() => {
    let cancelled = false;
    let client = null;

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

        const devId = deviceIdFromTopic(topic);
        if (devId) {
          setDeviceIds((prev) => {
            if (prev.includes(devId)) return prev;
            const next = [...prev, devId].sort();
            return next;
          });
        }

        const sel = selectedRef.current;
        const prefix = stmPrefix(sel);
        if (!topic.startsWith(prefix)) return;

        const subTopic = topic.slice(prefix.length);

        const entry = {
          ts,
          raw: payloadStr,
          parsed: safeJson(payloadStr),
        };

        if (subTopic.startsWith("ds18b20_")) {
          setTelemetry((prev) => ({
            ...prev,
            ds18b20: { ...prev.ds18b20, [subTopic]: entry },
          }));
        } else if (SINGLE_SENSORS.has(subTopic)) {
          setTelemetry((prev) => ({ ...prev, [subTopic]: entry }));
        }

        if (subTopic === "neo6m") {
          const loc = locationFromNeo6m(payloadStr);
          if (loc) setLocation(loc);
        }
      });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(connectTimer);
      clientRef.current = null;
      setTelemetry(createEmptyTelemetry());
      if (client) {
        client.removeAllListeners();
        client.end(true);
      }
    };
  }, []);

  useEffect(() => {
    if (deviceIds.length === 0) return;
    if (!deviceIds.includes(selectedDeviceId)) {
      setSelectedDeviceId(deviceIds[0]);
    }
  }, [deviceIds, selectedDeviceId]);

  return {
    connected,
    location,
    telemetry,
    publish,
    publishEsp,
    espTopicBase: espPrefix(selectedDeviceId),
    deviceIds,
    selectedDeviceId,
    setSelectedDeviceId,
  };
}
