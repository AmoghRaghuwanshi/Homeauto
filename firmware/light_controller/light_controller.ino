/*
 * ═══════════════════════════════════════════════════════════
 *  Home Automation — Light + Sensors Controller (ESP32-A)
 *  Controls 4 relays (active HIGH) + Gas & Motion sensors
 * ═══════════════════════════════════════════════════════════
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ─── Configuration ─────────────────────────────────────────
// CHANGE THESE to match your network
const char* WIFI_SSID     = "";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// CHANGE THIS to your laptop's local IP address (run ipconfig on laptop)
const char* MQTT_SERVER   = "10.121.93.209";
const int   MQTT_PORT     = 1883;
const char* MQTT_CLIENT   = "esp32-lights";

// ─── Relay Pins (active HIGH) ──────────────────────────────
const int RELAY_PINS[] = {4, 5, 18, 19};
const int NUM_RELAYS = 4;
bool relayStates[] = {false, false, false, false};

// ─── Sensor Pins ───────────────────────────────────────────
const int GAS_SENSOR_PIN    = 34;  // MQ-2/MQ-5/MQ-135 analog output (ADC)
const int MOTION_SENSOR_PIN = 27;  // PIR sensor (HC-SR501) digital output
const int LED_PIN           = 2;   // Built-in LED

// ─── Gas Sensor Thresholds ─────────────────────────────────
const int GAS_ALERT_THRESHOLD = 400;  // PPM above this = danger alert
const int GAS_WARN_THRESHOLD  = 200;  // PPM above this = warning

// ─── Timing ────────────────────────────────────────────────
const unsigned long HEARTBEAT_INTERVAL  = 30000;  // 30s relay heartbeat
const unsigned long SENSOR_READ_INTERVAL = 2000;  // 2s sensor readings
const unsigned long MOTION_HOLD_TIME     = 5000;  // Hold "detected" for 5s

// ─── Objects ───────────────────────────────────────────────
WiFiClient espClient;
PubSubClient mqtt(espClient);

unsigned long lastHeartbeat = 0;
unsigned long lastSensorRead = 0;
unsigned long lastMotionTime = 0;
bool motionDetected = false;
bool lastMotionState = false;  // Track changes to avoid spamming

// ─── WiFi Setup ────────────────────────────────────────────
void setupWiFi() {
  delay(10);
  Serial.println();
  Serial.print("[WiFi] Connecting to ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("[WiFi] Connected!");
    Serial.print("[WiFi] IP: ");
    Serial.println(WiFi.localIP());
    digitalWrite(LED_PIN, HIGH);
  } else {
    Serial.println();
    Serial.println("[WiFi] Failed to connect. Restarting...");
    ESP.restart();
  }
}

// ─── MQTT Callback (for light commands) ────────────────────
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.printf("[MQTT] Received: %s -> %s\n", topic, message.c_str());
  String topicStr = String(topic);

  for (int i = 0; i < NUM_RELAYS; i++) {
    String expectedTopic = "home/light/" + String(i + 1) + "/command";

    if (topicStr == expectedTopic) {
      if (message == "on") {
        relayStates[i] = true;
      } else if (message == "off") {
        relayStates[i] = false;
      } else if (message == "toggle") {
        relayStates[i] = !relayStates[i];
      }

      // Apply relay state (active HIGH)
      digitalWrite(RELAY_PINS[i], relayStates[i] ? HIGH : LOW);

      // Publish status back
      String statusTopic = "home/light/" + String(i + 1) + "/status";
      String statusMsg = relayStates[i] ? "on" : "off";
      mqtt.publish(statusTopic.c_str(), statusMsg.c_str(), true);

      Serial.printf("[Relay %d] %s (Pin %d = %s)\n",
                    i + 1, statusMsg.c_str(),
                    RELAY_PINS[i], relayStates[i] ? "HIGH" : "LOW");
      break;
    }
  }
}

// ─── MQTT Connect ──────────────────────────────────────────
void connectMQTT() {
  while (!mqtt.connected()) {
    Serial.print("[MQTT] Connecting...");

    // LWT: broker publishes "false" to this topic if ESP32 disconnects unexpectedly
    if (mqtt.connect(MQTT_CLIENT, NULL, NULL,
                     "home/esp32/lights/online", 1, true, "false")) {
      Serial.println(" connected!");

      // Publish online status
      mqtt.publish("home/esp32/lights/online", "true", true);

      // Subscribe to light command topics
      for (int i = 0; i < NUM_RELAYS; i++) {
        String topic = "home/light/" + String(i + 1) + "/command";
        mqtt.subscribe(topic.c_str());
        Serial.printf("[MQTT] Subscribed: %s\n", topic.c_str());
      }

      publishAllRelayStatus();
    } else {
      Serial.printf(" failed (rc=%d). Retrying in 5s...\n", mqtt.state());
      delay(5000);
    }
  }
}

// ─── Publish all relay statuses ────────────────────────────
void publishAllRelayStatus() {
  for (int i = 0; i < NUM_RELAYS; i++) {
    String statusTopic = "home/light/" + String(i + 1) + "/status";
    String statusMsg = relayStates[i] ? "on" : "off";
    mqtt.publish(statusTopic.c_str(), statusMsg.c_str(), true);
  }
}

// ─── Read & Publish Gas Sensor ─────────────────────────────
void readGasSensor() {
  int rawValue = analogRead(GAS_SENSOR_PIN);

  // Map 12-bit ADC (0-4095) to approximate PPM
  // Adjust this formula based on your specific MQ sensor calibration
  int ppm = map(rawValue, 0, 4095, 0, 1000);

  bool alert = ppm >= GAS_ALERT_THRESHOLD;

  // Build JSON payload
  JsonDocument doc;
  doc["gas_ppm"] = ppm;
  doc["raw"] = rawValue;
  doc["alert"] = alert;

  String payload;
  serializeJson(doc, payload);

  mqtt.publish("home/sensor/gas/data", payload.c_str());

  if (alert) {
    Serial.printf("[GAS] ⚠️ ALERT! PPM: %d (raw: %d)\n", ppm, rawValue);
  } else {
    Serial.printf("[GAS] PPM: %d (raw: %d)\n", ppm, rawValue);
  }
}

// ─── Read & Publish Motion Sensor ──────────────────────────
void readMotionSensor() {
  int pirState = digitalRead(MOTION_SENSOR_PIN);

  if (pirState == HIGH) {
    motionDetected = true;
    lastMotionTime = millis();
  }

  // Clear motion after hold time
  if (motionDetected && (millis() - lastMotionTime > MOTION_HOLD_TIME)) {
    motionDetected = false;
  }

  // Only publish when state changes to avoid flooding
  if (motionDetected != lastMotionState) {
    lastMotionState = motionDetected;

    JsonDocument doc;
    doc["motion"] = motionDetected;

    String payload;
    serializeJson(doc, payload);

    mqtt.publish("home/sensor/motion/data", payload.c_str());

    if (motionDetected) {
      Serial.println("[MOTION] 🚶 Motion detected!");
    } else {
      Serial.println("[MOTION] All clear.");
    }
  }
}

// ─── Setup ─────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println();
  Serial.println("╔═════════════════════════════════════════════╗");
  Serial.println("║  Home Auto — Lights + Sensors (ESP32-A)     ║");
  Serial.println("╚═════════════════════════════════════════════╝");

  // Initialize LED
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // Initialize relay pins (all OFF at start)
  for (int i = 0; i < NUM_RELAYS; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    digitalWrite(RELAY_PINS[i], LOW);
  }

  // Initialize sensor pins
  pinMode(GAS_SENSOR_PIN, INPUT);      // Analog input for gas sensor
  pinMode(MOTION_SENSOR_PIN, INPUT);   // Digital input for PIR sensor

  // Connect to WiFi
  setupWiFi();

  // Setup MQTT
  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(512);
  connectMQTT();

  // Let PIR sensor stabilize (takes ~30-60s on first power up)
  Serial.println("[MOTION] PIR sensor stabilizing...");
}

// ─── Loop ──────────────────────────────────────────────────
void loop() {
  // Reconnect if needed
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Connection lost. Reconnecting...");
    setupWiFi();
  }
  if (!mqtt.connected()) {
    connectMQTT();
  }

  mqtt.loop();

  // Read sensors at interval
  if (millis() - lastSensorRead > SENSOR_READ_INTERVAL) {
    lastSensorRead = millis();
    readGasSensor();
  }

  // Motion sensor is checked every loop (it's event-based)
  readMotionSensor();

  // Heartbeat: publish relay status every 30 seconds
  if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
    lastHeartbeat = millis();
    publishAllRelayStatus();
    Serial.println("[Heartbeat] Status published");
  }
}
