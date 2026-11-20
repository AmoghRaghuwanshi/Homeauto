/*
 * ═══════════════════════════════════════════════════════════
 *  VidyutRakshak — Light & Sensor Controller (ESP32-A)
 *  4-Channel Relay Controller + Gas & Motion Sensors via MQTT
 *  Vigyan Mela 2026
 * ═══════════════════════════════════════════════════════════
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <time.h>
#include "homeauto_config.h"
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// ─── Non-Volatile Storage (Power Cut State Memory) ─────────
Preferences prefs;

// ─── Wi-Fi & MQTT Configuration ────────────────────────────


// ─── Relay Pin Assignments ─────────────────────────────────
// Pins for Relays 1, 2, 3, 4 (Matched to VidyutRakshak Single-Layer PCB):
// Relay 1 (Light 1) = GPIO 23 | Relay 2 (Light 2) = GPIO 22
// Relay 3 (Light 3) = GPIO 19 | Relay 4 (Fan)     = GPIO 18
const int RELAY_PINS[] = {23, 22, 19, 18};
const int NUM_RELAYS   = 4;

// ─── Relay Polarity Configuration ──────────────────────────
// Set to true  if your relay triggers ON with HIGH signal (Active HIGH)
// Set to false if your relay triggers ON with LOW signal  (Active LOW - common for 5V optical modules)
const bool RELAY_ACTIVE_HIGH = true;

// Track current relay states (true = ON, false = OFF)
bool relayStates[NUM_RELAYS] = {false, false, false, false};

// ─── Sensor Pin Assignments ────────────────────────────────
const int GAS_SENSOR_PIN    = 34;  // MQ-2/MQ-5/MQ-135 analog input (ADC1_CH6)
const int MOTION_SENSOR_PIN = 27;  // PIR Motion sensor (HC-SR501) digital input
const int STATUS_LED_PIN    = 2;   // On-board status LED

// ─── Gas Thresholds & Calibration ──────────────────────────
const int GAS_ALERT_THRESHOLD = 400;  // PPM above this = alert/danger
const int GAS_WARN_THRESHOLD  = 200;  // PPM above this = warning

// ─── Timing Constants (all non-blocking) ───────────────────
const unsigned long HEARTBEAT_INTERVAL   = 30000; // 30s relay heartbeat
const unsigned long SENSOR_READ_INTERVAL  = 2000;  // 2s sensor check interval
const unsigned long MOTION_HOLD_TIME      = 5000;  // Hold motion state for 5s
const unsigned long GAS_FORCE_PUBLISH_INT = 4000; // Keep reports inside the hub's 10s freshness limit
const unsigned long MQTT_RETRY_INTERVAL   = 5000;  // Reconnect retry every 5s
const unsigned long WIFI_RETRY_INTERVAL   = 10000; // Wi-Fi reconnect retry every 10s

// ─── Runtime State ─────────────────────────────────────────
WiFiClientSecure espClient;
PubSubClient mqtt(espClient);

unsigned long lastHeartbeat      = 0;
unsigned long lastSensorRead     = 0;
unsigned long lastMotionPublish = 0;
unsigned long lastMotionTime     = 0;
unsigned long lastGasPublish     = 0;
unsigned long lastMqttRetry      = 0;
unsigned long lastWifiRetry      = 0;

int  lastPublishedPpm = -1;
bool lastAlertState   = false;
bool motionDetected   = false;
bool lastMotionState  = false;

// ─── Helper: Apply Hardware Relay State & Save to Flash ────
void applyRelayState(int index, bool isOn, bool save = true) {
  relayStates[index] = isOn;
  int pinLevel;
  if (RELAY_ACTIVE_HIGH) {
    pinLevel = isOn ? HIGH : LOW;
  } else {
    pinLevel = isOn ? LOW : HIGH;
  }
  digitalWrite(RELAY_PINS[index], pinLevel);

  if (save) {
    char key[8];
    snprintf(key, sizeof(key), "r%d", index);
    if (prefs.getBool(key, !isOn) != isOn) {
      prefs.putBool(key, isOn);
    }
  }
}

// ─── Publish Status for All Relays ─────────────────────────
void publishAllRelayStatus() {
  if (!mqtt.connected()) return;
  for (int i = 0; i < NUM_RELAYS; i++) {
    String topic = "home/light/" + String(i + 1) + "/status";
    String state = relayStates[i] ? "on" : "off";
    mqtt.publish(topic.c_str(), state.c_str(), true);
  }
}

// ─── MQTT Message Callback ─────────────────────────────────
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  message.trim();

  Serial.printf("[MQTT] %s -> %s\n", topic, message.c_str());
  String topicStr = String(topic);

  for (int i = 0; i < NUM_RELAYS; i++) {
    String expectedTopic = "home/light/" + String(i + 1) + "/command";
    if (topicStr == expectedTopic) {
      if (message == "on") {
        applyRelayState(i, true);
      } else if (message == "off") {
        applyRelayState(i, false);
      } else if (message == "toggle") {
        applyRelayState(i, !relayStates[i]);
      }

      // Publish updated status back with retain:true
      String statusTopic = "home/light/" + String(i + 1) + "/status";
      String state = relayStates[i] ? "on" : "off";
      mqtt.publish(statusTopic.c_str(), state.c_str(), true);

      Serial.printf("[Relay %d] %s (Pin %d = %s)\n",
                    i + 1, state.c_str(),
                    RELAY_PINS[i], relayStates[i] ? "ACTIVE" : "INACTIVE");
      break;
    }
  }
}

// ─── Read Gas Sensor (Smart non-flooding publish) ──────────
void checkGasSensor() {
  int rawValue = analogRead(GAS_SENSOR_PIN);

  // Map 12-bit ADC (0-4095) to approximate PPM (0-1000)
  int ppm = map(rawValue, 0, 4095, 0, 1000);
  if (ppm < 0) ppm = 0;
  bool alert = (ppm >= GAS_ALERT_THRESHOLD);

  unsigned long now = millis();
  // Publish immediately on alert change, significant PPM shift (>=20), or periodic keepalive
  bool stateChanged   = (alert != lastAlertState);
  bool levelShift     = abs(ppm - lastPublishedPpm) >= 20;
  bool periodicReport = (now - lastGasPublish >= GAS_FORCE_PUBLISH_INT);

  if (stateChanged || levelShift || periodicReport) {
    lastPublishedPpm = ppm;
    lastAlertState   = alert;
    lastGasPublish   = now;

    JsonDocument doc;
    doc["gas_ppm"] = ppm;
    doc["raw"]     = rawValue;
    doc["alert"]   = alert;

    String payload;
    serializeJson(doc, payload);

    if (mqtt.connected()) {
      mqtt.publish("home/sensor/gas/data", payload.c_str());
    }

    if (alert) {
      Serial.printf("[GAS] ⚠️ DANGER ALERT! PPM: %d (raw: %d)\n", ppm, rawValue);
    } else {
      Serial.printf("[GAS] PPM: %d (raw: %d)\n", ppm, rawValue);
    }
  }
}

// ─── Read Motion Sensor (Event-based publish) ──────────────
void checkMotionSensor() {
  int pirState = digitalRead(MOTION_SENSOR_PIN);

  if (pirState == HIGH) {
    motionDetected = true;
    lastMotionTime = millis();
  }

  // Clear motion after hold window
  if (motionDetected && (millis() - lastMotionTime > MOTION_HOLD_TIME)) {
    motionDetected = false;
  }

  // Only publish when state changes to avoid network flooding
  if (mqtt.connected() && (motionDetected != lastMotionState || millis() - lastMotionPublish >= 30000)) {
    lastMotionPublish = millis();
    lastMotionState = motionDetected;

    JsonDocument doc;
    doc["motion"] = motionDetected;

    String payload;
    serializeJson(doc, payload);

    if (mqtt.connected()) {
      mqtt.publish("home/sensor/motion/data", payload.c_str());
    }

    if (motionDetected) {
      Serial.println("[MOTION] 🚶 Motion detected!");
    } else {
      Serial.println("[MOTION] ✓ All clear.");
    }
  }
}

// ─── Non-blocking Wi-Fi Reconnect ──────────────────────────
void checkWiFiConnection() {
  if (WiFi.status() == WL_CONNECTED) return;

  unsigned long now = millis();
  if (now - lastWifiRetry >= WIFI_RETRY_INTERVAL) {
    lastWifiRetry = now;
    Serial.printf("[WiFi] Reconnecting to %s...\n", WIFI_SSID);
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
}

// ─── Non-blocking MQTT Connect ─────────────────────────────
void connectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (mqtt.connected()) return;
  if (time(nullptr) < 1700000000) return;

  unsigned long now = millis();
  if (now - lastMqttRetry < MQTT_RETRY_INTERVAL) return;
  lastMqttRetry = now;

  Serial.printf("[MQTT] Connecting to %s:%d...\n", MQTT_SERVER, MQTT_PORT);

  // LWT: Broker automatically marks board offline if connection breaks
  if (mqtt.connect(MQTT_CLIENT, MQTT_USERNAME, MQTT_PASSWORD,
                   "home/esp32/lights/online", 1, true, "false")) {
    Serial.println("[MQTT] Connected!");

    // Signal online status to server
    mqtt.publish("home/esp32/lights/online", "true", true);

    // Subscribe to all 4 light command topics
    for (int i = 0; i < NUM_RELAYS; i++) {
      String topic = "home/light/" + String(i + 1) + "/command";
      mqtt.subscribe(topic.c_str());
      Serial.printf("[MQTT] Subscribed: %s\n", topic.c_str());
    }

    // Publish current states so server & UI synchronize immediately
    publishAllRelayStatus();
    lastMotionPublish = millis() - 30000;
    lastGasPublish = millis() - GAS_FORCE_PUBLISH_INT;
    digitalWrite(STATUS_LED_PIN, HIGH);
  } else {
    Serial.printf("[MQTT] Connection failed (rc=%d). Will retry in %lu ms\n",
                  mqtt.state(), MQTT_RETRY_INTERVAL);
    digitalWrite(STATUS_LED_PIN, LOW);
  }
}

// ─── Setup ─────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(200);

  Serial.println();
  Serial.println("╔═══════════════════════════════════════════════════╗");
  Serial.println("║  VidyutRakshak — Lights & Sensors (ESP32-A)       ║");
  Serial.println("║  Relays: GPIO 18, 19, 22, 23 | Gas: 34 | PIR: 27  ║");
  Serial.println("║  Wi-Fi: Configured WiFi | Vigyan Mela 2026               ║");
  Serial.println("╚═══════════════════════════════════════════════════╝");

  // Initialize status LED
  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);

  // Initialize Preferences (NVS Flash for Power Cut State Memory)
  prefs.begin("lights_state", false);

  // Restore each relay to its exact state before power cut (instant <50ms restore)
  for (int i = 0; i < NUM_RELAYS; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    char key[8];
    snprintf(key, sizeof(key), "r%d", i);
    bool savedState = prefs.getBool(key, false);
    applyRelayState(i, savedState, false); // apply without re-saving
    Serial.printf("[Power-Restore] Relay %d (Pin %d) restored to: %s\n",
                  i + 1, RELAY_PINS[i], savedState ? "ON" : "OFF");
  }

  // Initialize sensor inputs
  pinMode(GAS_SENSOR_PIN, INPUT);
  pinMode(MOTION_SENSOR_PIN, INPUT);

  // Connect to Wi-Fi
  Serial.print("[WiFi] Initial connection to ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // Allow up to 10 seconds for initial connection
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n[WiFi] Initial connect timed out. Non-blocking retry active.");
  }

  // Configure MQTT
  espClient.setCACert(MQTT_CA_CERT);
  espClient.setHandshakeTimeout(2);
  mqtt.setSocketTimeout(1);
  mqtt.setKeepAlive(15);
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(512);

  connectMQTT();
}

// ─── Main Loop (Completely Non-blocking) ───────────────────
void loop() {
  // Check Wi-Fi and MQTT connectivity without blocking delays
  checkWiFiConnection();
  if (!mqtt.connected()) {
    connectMQTT();
  } else {
    mqtt.loop();
  }

  // Read gas sensor at interval
  if (millis() - lastSensorRead >= SENSOR_READ_INTERVAL) {
    lastSensorRead = millis();
    checkGasSensor();
  }

  // Check motion sensor (event-driven)
  if (HOMEAUTO_MOTION_ENABLED) checkMotionSensor();

  // Periodic heartbeat: sync relay statuses every 30 seconds
  if (millis() - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    lastHeartbeat = millis();
    publishAllRelayStatus();
    Serial.println("[Heartbeat] Relay status published");
  }
}
