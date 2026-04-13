/**
 * Senior Monitor – ESP8266 firmware
 *
 * Simulates a senior-monitoring device that periodically:
 *   - generates a random GPS location (walking around a fixed base point)
 *   - generates random accelerometer readings and detects falls
 *     (acceleration magnitude above FALL_THRESHOLD)
 *   - sends a panic-button event when the (simulated) button pin is LOW
 *
 * All data is sent as JSON via HTTP POST to a backend server.
 *
 * Adjust the constants below to match your network and server.
 */

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>

// ─── Configuration ────────────────────────────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Backend server address (update to your server's IP / domain)
const char* SERVER_URL    = "http://192.168.1.100:3001/data";

// Intervals
const unsigned long LOCATION_INTERVAL_MS    = 30000;  // 30 s
const unsigned long ACCEL_INTERVAL_MS       =  2000;  //  2 s
const unsigned long PANIC_CHECK_INTERVAL_MS =   500;  //  0.5 s

// Panic-button GPIO pin (active LOW with internal pull-up)
const int PANIC_BUTTON_PIN = D3;

// Fall-detection threshold (simulated g-force magnitude)
const float FALL_THRESHOLD = 2.5f;

// Base GPS coordinates (Warsaw, Poland)
const double BASE_LAT = 52.2297;
const double BASE_LNG = 21.0122;

// ─── State ────────────────────────────────────────────────────────────────────
unsigned long lastLocationSent = 0;
unsigned long lastAccelSent    = 0;
unsigned long lastPanicCheck   = 0;
bool          panicSent        = false;   // debounce – send once per press

WiFiClient   wifiClient;
HTTPClient   http;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a random float in [lo, hi].
 */
float randFloat(float lo, float hi) {
  return lo + (float)random(0, 10000) / 10000.0f * (hi - lo);
}

/**
 * Sends a JSON payload to the backend via HTTP POST.
 */
void postJSON(const String& payload) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Not connected, skipping send.");
    return;
  }
  http.begin(wifiClient, SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(payload);
  Serial.printf("[HTTP] POST %s → %d\n", SERVER_URL, code);
  http.end();
}

// ─── Data generators ──────────────────────────────────────────────────────────

void sendLocation() {
  // Simulate senior walking: small random offset (~±0.002° ≈ ±200 m)
  double lat = BASE_LAT + ((double)random(-200, 201)) / 100000.0;
  double lng = BASE_LNG + ((double)random(-200, 201)) / 100000.0;

  String payload = "{\"type\":\"location\","
                   "\"lat\":" + String(lat, 6) + ","
                   "\"lng\":" + String(lng, 6) + "}";
  Serial.println("[LOC]  " + payload);
  postJSON(payload);
}

void sendAccelerometer() {
  // Simulate random accelerometer values (g-force per axis)
  float ax = randFloat(-1.2f, 1.2f);
  float ay = randFloat(-1.2f, 1.2f);
  float az = randFloat( 0.8f, 1.2f);  // mostly gravity on Z

  // Occasionally simulate a fall (≈5 % chance)
  bool simulateFall = (random(0, 100) < 5);
  if (simulateFall) {
    ax = randFloat(2.0f, 4.0f);
    ay = randFloat(2.0f, 4.0f);
    az = randFloat(0.1f, 0.5f);
  }

  float magnitude = sqrt(ax * ax + ay * ay + az * az);
  bool  fall      = magnitude > FALL_THRESHOLD;

  String payload = "{\"type\":\"accelerometer\","
                   "\"ax\":" + String(ax, 3) + ","
                   "\"ay\":" + String(ay, 3) + ","
                   "\"az\":" + String(az, 3) + ","
                   "\"magnitude\":" + String(magnitude, 3) + ","
                   "\"fall\":" + (fall ? "true" : "false") + "}";
  Serial.println("[ACCEL] " + payload);
  postJSON(payload);
}

void checkPanicButton() {
  bool pressed = (digitalRead(PANIC_BUTTON_PIN) == LOW);
  if (pressed && !panicSent) {
    String payload = "{\"type\":\"panic\"}";
    Serial.println("[PANIC] Button pressed – sending alert!");
    postJSON(payload);
    panicSent = true;
  } else if (!pressed) {
    panicSent = false;  // reset when button is released
  }
}

// ─── Arduino lifecycle ────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  randomSeed(analogRead(A0));  // seed from floating ADC pin

  pinMode(PANIC_BUTTON_PIN, INPUT_PULLUP);

  Serial.println("\n[BOOT] Senior Monitor starting…");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("[WiFi] Connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\n[WiFi] Connected – IP: %s\n", WiFi.localIP().toString().c_str());
}

void loop() {
  unsigned long now = millis();

  if (now - lastLocationSent >= LOCATION_INTERVAL_MS) {
    lastLocationSent = now;
    sendLocation();
  }

  if (now - lastAccelSent >= ACCEL_INTERVAL_MS) {
    lastAccelSent = now;
    sendAccelerometer();
  }

  if (now - lastPanicCheck >= PANIC_CHECK_INTERVAL_MS) {
    lastPanicCheck = now;
    checkPanicButton();
  }
}
