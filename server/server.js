"use strict";

const express = require("express");
const cors    = require("cors");
const http    = require("http");
const { WebSocketServer, WebSocket } = require("ws");

const PORT = process.env.PORT || 3001;

const state = {
  location:   null,  
  lastFall:   null,   
  lastPanic:  null,   
  alerts: [],       
};

const MAX_ALERTS = 50;

function addAlert(alert) {
  state.alerts.unshift(alert);
  if (state.alerts.length > MAX_ALERTS) state.alerts.pop();
}

const app    = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get("/state", (_req, res) => res.json(state));

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

server.listen(PORT, () => {
  console.log(`[server] Senior Monitor backend listening on port ${PORT}`);
  console.log(`[server] POST http://localhost:${PORT}/data   ← ESP8266`);
  console.log(`[server] WS   ws://localhost:${PORT}         ← PWA`);
});
