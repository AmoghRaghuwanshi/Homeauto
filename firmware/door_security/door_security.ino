/*
 * ═══════════════════════════════════════════════════════════
 *  Home Security — Door RFID Controller (ESP32-B)
 *  RFID-RC522 reader + door lock relay via MQTT
 * ═══════════════════════════════════════════════════════════
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>

// ─── Configuration ─────────────────────────────────────────
// CHANGE THESE to match your network
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// CHANGE THIS to your laptop's local IP address
const char* MQTT_SERVER   = "10.121.93.209";
const int   MQTT_PORT     = 1883;
const char* MQTT_CLIENT   = "esp32-door";

// Door ID
const String DOOR_ID = "1";

// Pin assignments
const int DOOR_RELAY_PIN = 4;    // Door lock relay (active HIGH)
const int RED_LED_PIN    = 15;   // Access denied LED
const int GREEN_LED_PIN  = 16;   // Access granted LED
const int BUZZER_PIN     = 17;   // Optional buzzer

// RFID-RC522 pins (SPI)
const int SS_PIN   = 5;   // SDA/SS
const int RST_PIN  = 21;  // RST
// SCK  = 18 (default SPI)
// MOSI = 23 (default SPI)
// MISO = 19 (default SPI)

// Timing
const unsigned long UNLOCK_DURATION  = 5000;   // Door stays unlocked for 5 sec
const unsigned long HEARTBEAT_INTERVAL = 30000;
const unsigned long SCAN_COOLDOWN    = 2000;   // Min time between scans

// ─── Objects ───────────────────────────────────────────────
WiFiClient espClient;
PubSubClient mqtt(espClient);
MFRC522 rfid(SS_PIN, RST_PIN);

bool doorLocked = true;
unsigned long unlockTime = 0;
unsigned long lastHeartbeat = 0;
unsigned long lastScan = 0;

// MQTT topics
String cmdTopic;
String statusTopic;
String rfidTopic;

// ─── WiFi Setup ────────────────────────────────────────────
void setupWiFi() {
  Serial.print("[WiFi] Connecting to ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n[WiFi] Failed. Restarting...");
    ESP.restart();
  }
}

// ─── MQTT Callback ─────────────────────────────────────────
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.printf("[MQTT] %s -> %s\n", topic, message.c_str());

  String topicStr = String(topic);

  if (topicStr == cmdTopic) {
    if (message == "unlock") {
      unlockDoor();
    } else if (message == "lock") {
      lockDoor();
    } else if (message == "toggle_lock") {
      if (doorLocked) unlockDoor();
      else lockDoor();
    } else if (message == "deny") {
      accessDenied();
    }
  }
}

// ─── Door Control ──────────────────────────────────────────
void unlockDoor() {
  Serial.println("[Door] UNLOCKED");
  doorLocked = false;
  unlockTime = millis();
  digitalWrite(DOOR_RELAY_PIN, HIGH);
  digitalWrite(GREEN_LED_PIN, HIGH);
  digitalWrite(RED_LED_PIN, LOW);
  mqtt.publish(statusTopic.c_str(), "unlocked", true);
}

void lockDoor() {
  Serial.println("[Door] LOCKED");
  doorLocked = true;
  unlockTime = 0;
  digitalWrite(DOOR_RELAY_PIN, LOW);
  digitalWrite(GREEN_LED_PIN, LOW);
  digitalWrite(RED_LED_PIN, LOW);
  mqtt.publish(statusTopic.c_str(), "locked", true);
}

void accessDenied() {
  Serial.println("[Door] ACCESS DENIED");
  // Flash red LED 3 times
  for (int i = 0; i < 3; i++) {
    digitalWrite(RED_LED_PIN, HIGH);
    delay(200);
    digitalWrite(RED_LED_PIN, LOW);
    delay(200);
  }
  mqtt.publish(statusTopic.c_str(), "denied", true);
}

// ─── RFID Scanning ─────────────────────────────────────────
String getCardUID() {
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (i > 0) uid += ":";
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

void handleRfidScan() {
  // Check for new card
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }

  // Cooldown check
  if (millis() - lastScan < SCAN_COOLDOWN) {
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }
  lastScan = millis();

  String uid = getCardUID();
  Serial.printf("[RFID] Card scanned: %s\n", uid.c_str());

  // Build JSON payload
  JsonDocument doc;
  doc["uid"] = uid;
  doc["timestamp"] = millis();

  String payload;
  serializeJson(doc, payload);

  // Publish RFID event to server (server decides grant/deny)
  mqtt.publish(rfidTopic.c_str(), payload.c_str());

  // Brief LED flash to acknowledge scan
  digitalWrite(GREEN_LED_PIN, HIGH);
  delay(100);
  digitalWrite(GREEN_LED_PIN, LOW);

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

// ─── MQTT Connect ──────────────────────────────────────────
void connectMQTT() {
  while (!mqtt.connected()) {
    Serial.print("[MQTT] Connecting...");

    // LWT: broker publishes "false" if ESP32 disconnects unexpectedly
    if (mqtt.connect(MQTT_CLIENT, NULL, NULL,
                     "home/esp32/door/online", 1, true, "false")) {
      Serial.println(" connected!");

      // Publish online status
      mqtt.publish("home/esp32/door/online", "true", true);

      mqtt.subscribe(cmdTopic.c_str());
      Serial.printf("[MQTT] Subscribed: %s\n", cmdTopic.c_str());

      // Publish initial status
      String status = doorLocked ? "locked" : "unlocked";
      mqtt.publish(statusTopic.c_str(), status.c_str(), true);
    } else {
      Serial.printf(" failed (rc=%d). Retrying in 5s...\n", mqtt.state());
      delay(5000);
    }
  }
}

// ─── Setup ─────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println();
  Serial.println("╔══════════════════════════════════════╗");
  Serial.println("║  Home Security — Door RFID (B)       ║");
  Serial.println("╚══════════════════════════════════════╝");

  // Build topic strings
  cmdTopic    = "home/door/" + DOOR_ID + "/command";
  statusTopic = "home/door/" + DOOR_ID + "/status";
  rfidTopic   = "home/door/" + DOOR_ID + "/rfid";

  // Initialize pins
  pinMode(DOOR_RELAY_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(DOOR_RELAY_PIN, LOW);  // Locked
  digitalWrite(RED_LED_PIN, LOW);
  digitalWrite(GREEN_LED_PIN, LOW);

  // Initialize SPI and RFID
  SPI.begin();
  rfid.PCD_Init();
  delay(100);
  Serial.print("[RFID] Reader: ");
  rfid.PCD_DumpVersionToSerial();

  // Connect
  setupWiFi();
  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(512);
  connectMQTT();
}

// ─── Loop ──────────────────────────────────────────────────
void loop() {
  if (WiFi.status() != WL_CONNECTED) setupWiFi();
  if (!mqtt.connected()) connectMQTT();
  mqtt.loop();

  // Scan for RFID cards
  handleRfidScan();

  // Auto-lock after unlock duration
  if (!doorLocked && unlockTime > 0 && (millis() - unlockTime > UNLOCK_DURATION)) {
    Serial.println("[Door] Auto-locking...");
    lockDoor();
  }

  // Heartbeat
  if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
    lastHeartbeat = millis();
    String status = doorLocked ? "locked" : "unlocked";
    mqtt.publish(statusTopic.c_str(), status.c_str(), true);
    Serial.println("[Heartbeat] Status published");
  }
}
