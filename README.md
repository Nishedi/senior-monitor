# Senior Monitor

A complete **senior health & location monitoring system** built on ESP8266 + Node.js + React PWA.

```
ESP8266 ──POST /data──▶ Node.js Server ──WebSocket──▶ React PWA (caregiver)
```

---

## Architecture

| Component | Technology | Directory |
|-----------|-----------|-----------|
| IoT device firmware | Arduino C++ (ESP8266) | `esp8266/` |
| Backend server | Node.js · Express · WebSocket (`ws`) | `server/` |
| Caregiver dashboard | React · Vite · Leaflet · PWA | `pwa/` |

---

## Features

### ESP8266 firmware (`esp8266/senior_monitor.ino`)
- Connects to Wi-Fi
- Every **30 s** — generates a random GPS location near a configurable base point and POSTs it to the backend
- Every **2 s** — generates simulated accelerometer readings; a fall is detected when the acceleration magnitude exceeds **2.5 g** (~5 % random chance for demo purposes)
- Every **0.5 s** — polls a GPIO pin for a physical panic button (active LOW with internal pull-up)
- All events are sent as JSON via HTTP POST to `POST /data`

> **No real sensors required.** All data is randomly generated so the system can be demonstrated with a bare ESP8266 board.

### Backend server (`server/`)
- `POST /data` — receives JSON events from the ESP8266
- `GET /state` — returns the latest cached state (useful for initial PWA load)
- `GET /health` — health check endpoint
- WebSocket — broadcasts every incoming event to all connected PWA clients in real-time; sends a state snapshot to each newly connected client

### Caregiver PWA (`pwa/`)
- **Live map** — shows the senior's latest GPS position on an OpenStreetMap map (Leaflet)
- **Real-time alerts** — fall detection and panic button events appear instantly via WebSocket
- **Auto-reconnect** — automatically reconnects to the server on connection loss
- **Installable PWA** — service worker + web manifest (works offline for cached assets, installable on mobile/desktop)
- Polish UI

---

## Quick start

### 1. Backend

```bash
cd server
npm install
npm start
# Server listens on http://localhost:3001
```

### 2. React PWA

```bash
cd pwa
cp .env.example .env   # adjust VITE_WS_URL if backend is on a different host
npm install
npm run dev            # development server on http://localhost:5173
# or
npm run build && npm run preview   # production build
```

### 3. ESP8266 firmware

1. Open `esp8266/senior_monitor.ino` in the **Arduino IDE** (with ESP8266 board package installed)
2. Update the constants at the top of the file:
   - `WIFI_SSID` / `WIFI_PASSWORD` — your Wi-Fi credentials
   - `SERVER_URL` — your backend server's IP/hostname, e.g. `http://192.168.1.100:3001/data`
3. Flash to your ESP8266 board
4. Open the Serial Monitor (115 200 baud) to watch live output

---

## API reference

### `POST /data`

Accepts JSON with a `type` field. All payloads are forwarded to WebSocket clients.

#### Location update
```json
{ "type": "location", "lat": 52.2297, "lng": 21.0122 }
```

#### Accelerometer reading
```json
{
  "type": "accelerometer",
  "ax": 0.12, "ay": -0.05, "az": 0.99,
  "magnitude": 1.00,
  "fall": false
}
```

#### Panic button
```json
{ "type": "panic" }
```

### WebSocket messages

The server sends the same JSON objects as received, enriched with a `ts` timestamp (ISO-8601). On initial connection a `state_snapshot` message is sent:

```json
{
  "type": "state_snapshot",
  "location": { "lat": 52.2297, "lng": 21.0122, "ts": "2024-01-01T12:00:00.000Z" },
  "lastFall": null,
  "lastPanic": null,
  "alerts": []
}
```

---

## Environment variables

### `pwa/.env`
| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_WS_URL` | `ws://localhost:3001` | WebSocket URL of the backend server |

### Server
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP/WS port the server listens on |
