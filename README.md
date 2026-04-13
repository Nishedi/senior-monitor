# Senior Monitor

A complete **senior health & location monitoring system** built on ESP8266 + Node.js + React PWA using **MQTT** as the transport layer between the device and the server.

```
ESP8266 ──MQTT publish──▶ MQTT Broker ──MQTT subscribe──▶ Node.js Server ──WebSocket──▶ React PWA (caregiver)
```

---

## Architecture

| Component | Technology | Directory |
|-----------|-----------|-----------|
| IoT device firmware | Arduino C++ (ESP8266 · PubSubClient) | `esp8266/` |
| Backend server | Node.js · Express · MQTT · WebSocket (`ws`) | `server/` |
| Caregiver dashboard | React · Vite · Leaflet · PWA | `pwa/` |

---

## Features

### ESP8266 firmware (`esp8266/senior_monitor.ino`)
- Connects to Wi-Fi and then to the MQTT broker
- Every **30 s** — generates a random GPS location near a configurable base point and publishes it to `senior/location`
- Every **2 s** — generates simulated accelerometer readings; a fall is detected when the acceleration magnitude exceeds **2.5 g** (~5 % random chance for demo purposes); published to `senior/accelerometer`
- Every **0.5 s** — polls a GPIO pin for a physical panic button (active LOW with internal pull-up); published to `senior/panic`
- All events are JSON payloads sent via MQTT

> **No real sensors required.** All data is randomly generated so the system can be demonstrated with a bare ESP8266 board.

### Backend server (`server/`)
- Connects to the MQTT broker and subscribes to `senior/#`
- Processes incoming MQTT messages and updates the shared state
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

### 0. MQTT Broker

You need a running MQTT broker (e.g. [Mosquitto](https://mosquitto.org/)):

```bash
# Linux
sudo apt install mosquitto mosquitto-clients
sudo systemctl start mosquitto

# macOS
brew install mosquitto
brew services start mosquitto

# Docker
docker run -d -p 1883:1883 eclipse-mosquitto
```

### 1. Backend

```bash
cd server
npm install
npm start
# Server listens on http://localhost:3001 and connects to mqtt://localhost:1883
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

1. Install the **PubSubClient** library in the Arduino IDE (`Sketch → Include Library → Manage Libraries → search "PubSubClient"`)
2. Open `esp8266/senior_monitor.ino` in the **Arduino IDE** (with ESP8266 board package installed)
3. Update the constants at the top of the file:
   - `WIFI_SSID` / `WIFI_PASSWORD` — your Wi-Fi credentials
   - `MQTT_BROKER` — IP address of the machine running the MQTT broker, e.g. `"192.168.1.100"`
   - `MQTT_PORT` — broker port (default `1883`)
4. Flash to your ESP8266 board
5. Open the Serial Monitor (115 200 baud) to watch live output

---

## MQTT Topics

| Topic | Direction | Payload |
|-------|-----------|---------|
| `senior/location` | ESP8266 → broker | `{"type":"location","lat":52.2297,"lng":21.0122}` |
| `senior/accelerometer` | ESP8266 → broker | `{"type":"accelerometer","ax":0.12,"ay":-0.05,"az":0.99,"magnitude":1.00,"fall":false}` |
| `senior/panic` | ESP8266 → broker | `{"type":"panic"}` |

The server subscribes to `senior/#` and forwards all messages to connected WebSocket clients.

---

## WebSocket messages

The server sends the same JSON objects as received from MQTT, enriched with a `ts` timestamp (ISO-8601). On initial connection a `state_snapshot` message is sent:

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
| `MQTT_BROKER` | `mqtt://localhost:1883` | MQTT broker URL |

