"use strict";

const express  = require("express");
const cors     = require("cors");
const http     = require("http");
const { WebSocketServer, WebSocket } = require("ws");
const mqtt     = require("mqtt");

const PORT        = process.env.PORT        || 3001;
const MQTT_BROKER = process.env.MQTT_BROKER || "mqtt://156.17.40.152:1883";
const MQTT_TOPIC  = "senior/#";

const state = {
  location:   null,
  lastFall:   null,
  lastPanic:  null,
  alerts:     [],
};

const MAX_ALERTS = 50;

function addAlert(alert) {
  state.alerts.unshift(alert);
  if (state.alerts.length > MAX_ALERTS) state.alerts.pop();
}

// ── HTTP / WebSocket server ───────────────────────────────────────────────────

const app    = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/state",  (_req, res) => res.json(state));

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("[ws] Client connected. Total:", wss.clients.size);
  ws.send(JSON.stringify({ type: "state_snapshot", ...state }));
  ws.on("close", () => {
    console.log("[ws] Client disconnected. Total:", wss.clients.size);
  });
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// ── Event processing (shared by MQTT) ────────────────────────────────────────

function processEvent(body) {
  if (!body || !body.type) {
    console.warn("[event] Missing 'type' field, ignoring.");
    return;
  }

  const ts    = new Date().toISOString();
  const event = { ...body, ts };

  switch (body.type) {
    case "location":
      state.location = { lat: body.lat, lng: body.lng, ts };
      break;

    case "accelerometer":
      if (body.fall) {
        state.lastFall = { ax: body.ax, ay: body.ay, az: body.az, magnitude: body.magnitude, ts };
        addAlert({ type: "fall", ...state.lastFall });
      }
      break;

    case "panic":
      state.lastPanic = { ts };
      addAlert({ type: "panic", ts });
      break;

    default:
      console.warn("[event] Unknown event type:", body.type);
      return;
  }

  broadcast(event);
}

// ── MQTT client ───────────────────────────────────────────────────────────────

const mqttClient = mqtt.connect(MQTT_BROKER, {
  clientId:      "senior-monitor-server",
  clean:         true,
  reconnectPeriod: 3000,
});

mqttClient.on("connect", () => {
  console.log(`[mqtt] Connected to broker ${MQTT_BROKER}`);
  mqttClient.subscribe(MQTT_TOPIC, (err) => {
    if (err) console.error("[mqtt] Subscribe error:", err.message);
    else     console.log(`[mqtt] Subscribed to ${MQTT_TOPIC}`);
  });
});

mqttClient.on("message", (topic, message) => {
  let body;
  try {
    body = JSON.parse(message.toString());
  } catch {
    console.warn("[mqtt] Invalid JSON on topic", topic);
    return;
  }
  console.log(`[mqtt] Message on ${topic}:`, body);
  processEvent(body);
});

mqttClient.on("error",      (err) => console.error("[mqtt] Error:", err.message));
mqttClient.on("reconnect",  ()    => console.log("[mqtt] Reconnecting…"));
mqttClient.on("disconnect", ()    => console.log("[mqtt] Disconnected from broker"));

// ── Start HTTP server ─────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[server] Senior Monitor backend listening on port ${PORT}`);
  console.log(`[server] MQTT broker: ${MQTT_BROKER}  (topics: ${MQTT_TOPIC})`);
  console.log(`[server] WS   ws://localhost:${PORT}  ← PWA`);
});
