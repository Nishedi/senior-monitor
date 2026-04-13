#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <PubSubClient.h>

const char* WIFI_SSID     = "LabInf102";
const char* WIFI_PASSWORD = "laboratoriuminformatyki102";

const char* MQTT_BROKER   = "156.17.40.152";
const int   MQTT_PORT     = 1883;
const char* MQTT_CLIENT_ID = "senior-monitor-esp8266";

const char* TOPIC_LOCATION      = "senior/location";
const char* TOPIC_ACCELEROMETER = "senior/accelerometer";
const char* TOPIC_PANIC         = "senior/panic";

const unsigned long LOCATION_INTERVAL_MS    = 30000;
const unsigned long ACCEL_INTERVAL_MS       =  2000;
const unsigned long PANIC_CHECK_INTERVAL_MS =   500;

const int PANIC_BUTTON_PIN = 0;

const float FALL_THRESHOLD = 2.5f;

const double BASE_LAT = 51.111930;
const double BASE_LNG = 17.060444;

unsigned long lastLocationSent = 0;
unsigned long lastAccelSent    = 0;
unsigned long lastPanicCheck   = 0;
bool          panicSent        = false;

WiFiClient   wifiClient;
PubSubClient mqttClient(wifiClient);

float randFloat(float lo, float hi) {
  return lo + (float)random(0, 10000) / 10000.0f * (hi - lo);
}

void connectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("[MQTT] Connecting…");
    if (mqttClient.connect(MQTT_CLIENT_ID)) {
      Serial.println(" connected.");
    } else {
      Serial.printf(" failed (state=%d), retrying in 3 s\n", mqttClient.state());
      delay(3000);
    }
  }
}

void publishJSON(const char* topic, const String& payload) {
  if (!mqttClient.connected()) connectMQTT();
  bool ok = mqttClient.publish(topic, payload.c_str());
  Serial.printf("[MQTT] publish %s → %s\n", topic, ok ? "ok" : "FAIL");
}

void sendLocation() {
  double lat = BASE_LAT + ((double)random(-200, 201)) / 100000.0;
  double lng = BASE_LNG + ((double)random(-200, 201)) / 100000.0;

  String payload = "{\"type\":\"location\","
                   "\"lat\":" + String(lat, 6) + ","
                   "\"lng\":" + String(lng, 6) + "}";
  Serial.println("[LOC]  " + payload);
  publishJSON(TOPIC_LOCATION, payload);
}

void sendAccelerometer() {
  float ax = randFloat(-1.2f, 1.2f);
  float ay = randFloat(-1.2f, 1.2f);
  float az = randFloat( 0.8f, 1.2f);

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
  publishJSON(TOPIC_ACCELEROMETER, payload);
}

void checkPanicButton() {
  double pressed_chance = ((double)random(0, 100));
  bool pressed = (digitalRead(PANIC_BUTTON_PIN) == LOW);
  if (pressed_chance < 1) {
    pressed = true;
  }
  if (pressed && !panicSent) {
    String payload = "{\"type\":\"panic\"}";
    Serial.println("[PANIC] Button pressed – sending alert!");
    publishJSON(TOPIC_PANIC, payload);
    panicSent = true;
  } else if (!pressed) {
    panicSent = false;
  }
}

void setup() {
  Serial.begin(115200);
  randomSeed(analogRead(A0));

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

  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  connectMQTT();
}

void loop() {
  if (!mqttClient.connected()) connectMQTT();
  mqttClient.loop();

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
