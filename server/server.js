/**
 * Senior Monitor – Backend Server
 *
 * Listens on HTTP for data POSTed by the ESP8266 and re-broadcasts each event
 * to all connected PWA clients over WebSocket.
 *
 * Endpoints:
 *   POST /data          – receive JSON event from ESP8266
 *   GET  /state         – return current cached state (location, last events)
 *   GET  /health        – simple health-check
 *
 * WebSocket (ws://host:PORT):
 *   Clients receive every event forwarded from the device plus the full state
 *   snapshot on connection.
 */

"use strict";

const express = require("express");
const cors    = require("cors");
const http    = require("http");
const { WebSocketServer, WebSocket } = require("ws");

const PORT = process.env.PORT || 3001;

// ─── In-memory state ──────────────────────────────────────────────────────────
const state = {
  location:   null,   // { lat, lng, ts }
  lastFall:   null,   // { ax, ay, az, magnitude, ts }
  lastPanic:  null,   // { ts }
  alerts: [],         // last 50 alerts  (type, ts, …data)
};

const MAX_ALERTS = 50;

function addAlert(alert) {
  state.alerts.unshift(alert);
  if (state.alerts.length > MAX_ALERTS) state.alerts.pop();
}

// ─── Express app ──────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Return current cached state to PWA on initial load
app.get("/state", (_req, res) => res.json(state));

// Receive data from ESP8266
app.post("/data", (req, res) => {
  const body = req.body;
  if (!body || !body.type) {
    return res.status(400).json({ error: "Missing 'type' field." });
  }

  const ts   = new Date().toISOString();
  let event  = { ...body, ts };

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
      console.warn("[server] Unknown event type:", body.type);
      return res.status(400).json({ error: "Unknown event type." });
  }

  broadcast(event);
  res.json({ ok: true });
});

// ─── WebSocket server ─────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("[ws] Client connected. Total:", wss.clients.size);

  // Send current state snapshot to newly connected client
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

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`[server] Senior Monitor backend listening on port ${PORT}`);
  console.log(`[server] POST http://localhost:${PORT}/data   ← ESP8266`);
  console.log(`[server] WS   ws://localhost:${PORT}         ← PWA`);
});
