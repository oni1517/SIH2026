/*
 * ==============================================================================
 * SENTINELROVER — ESP32 SUBTERRANEAN SENSOR MESH NODE (TWO-WAY MQTT)
 * Sensors: MPU6500 (I2C), DHT22, LDR (Photoresistor), MQ135 (Gas), PIR Motion
 * Connectivity: WiFi + MQTT (PubSubClient) + JSON (ArduinoJson)
 * Commands: "CALIBRATE" via Serial OR via MQTT topic "mine/node/cmd/calibrate"
 *
 * FIX APPLIED: MQTT client ID shortened to stay under the 23-character limit
 * (rc=2 / MQTT_CONNECT_BAD_CLIENT_ID was caused by the old ID being 25 chars).
 * Topics are unchanged, so this pairs directly with the web monitor.
 * ==============================================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <DHT.h>

// ======================== WIFI & MQTT CREDENTIALS ========================
const char* WIFI_SSID       = "rpi";
const char* WIFI_PASSWORD   = "12345678";

// MQTT Broker (Public HiveMQ / EMQX / Local Mosquitto / Cloud MQTT)
const char* MQTT_BROKER     = "broker.hivemq.com";
const int   MQTT_PORT       = 1883;
const char* MQTT_USER       = ""; // Optional: Leave empty if no auth
const char* MQTT_PASS       = ""; // Optional: Leave empty if no auth

// Node Unique Identifier
const char* NODE_ID         = "NODE-SRF-01"; // e.g. NODE-SRF-01, NODE-LVL3-01

// ======================== MQTT TOPICS ===================================
// These match the web monitor exactly — do not change without updating the site.
const char* TOPIC_TELEMETRY   = "mine/node/telemetry";
const char* TOPIC_STATUS      = "mine/node/status";
const char* TOPIC_CALIB_RES   = "mine/node/calibration/result";
const char* TOPIC_CMD_CALIB   = "mine/node/cmd/calibrate";
const char* TOPIC_CMD_CONFIG  = "mine/node/cmd/config";

// ======================== PIN DEFINITIONS ================================
#define DHTPIN        4
#define DHTTYPE       DHT22
#define MQ135_PIN     34
#define LDR_PIN       35
#define PIR_PIN       27
#define MPU6500_ADDR  0x68
#define LED_STATUS    2   // Onboard LED for status & calibration pulse

// ======================== CONSTANTS & THRESHOLDS =========================
const float RL                      = 10000.0;
const float VCC                     = 3.3;
const int   ADC_MAX                 = 4095;
int         LDR_THRESHOLD_DROP      = 500;
float       MQ135_GAS_THRESHOLD     = 100.0;
float       MQ135_HAZARD_THRESHOLD  = 400.0;
float       HUMIDITY_THRESHOLD      = 20.0;
float       VIBRATION_WARN_THRES    = 10.0;
float       VIBRATION_CRIT_THRES    = 20.0;

// ======================== GLOBAL VARIABLES ===============================
DHT dht(DHTPIN, DHTTYPE);
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// Sensor values
float vibration = 0;
float baselineVibration = 0;

float baselineTemp = 25.0;
float baselineHumidity = 60.0;

int ldrBaseline = 2500;
int ldrValue = 0;

float R0 = 30000;
float ppm = 0;

int pirState = 0;
bool isCalibrating = false;
bool isCalibrated = false;

unsigned long lastTelemetryPub = 0;
unsigned long lastDisplay = 0;

// ======================== FUNCTION DECLARATIONS ==========================
void setupWiFi();
void reconnectMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void readAllSensors();
void readMPU6500();
void readDHT22();
void readLDR();
void readMQ135();
void readPIR();
void calibrateAll();
void publishTelemetry();
void publishCalibrationResult();
void displayReadings();

// ======================== SETUP ==========================================
void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(PIR_PIN, INPUT);
  pinMode(LED_STATUS, OUTPUT);
  digitalWrite(LED_STATUS, LOW);

  Wire.begin();
  dht.begin();
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  // Initialize MPU6500 (Wake up from sleep)
  Wire.beginTransmission(MPU6500_ADDR);
  Wire.write(0x6B);
  Wire.write(0x00);
  Wire.endTransmission();

  Serial.println("\n==================================================");
  Serial.println("  SENTINELROVER — ESP32 TWO-WAY MQTT NODE");
  Serial.println("==================================================");

  // Connect to WiFi & MQTT
  setupWiFi();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);

  Serial.println("PIR Sensor settling... (10 seconds)");
  delay(10000);
  Serial.println("System Ready! Listening for 'CALIBRATE' command...\n");
}

// ======================== MAIN LOOP ======================================
void loop() {
  // Maintain WiFi & MQTT connectivity
  if (WiFi.status() != WL_CONNECTED) {
    setupWiFi();
  }
  if (!mqttClient.connected()) {
    reconnectMQTT();
  }
  mqttClient.loop();

  // Handle Serial Commands
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    cmd.toUpperCase();

    if (cmd == "CALIBRATE") {
      calibrateAll();
    } else {
      Serial.println("[CMD] Unknown Serial command. Use 'CALIBRATE'");
    }
  }

  // Periodic sensor read & MQTT publish (Every 1000ms = 1s)
  if (millis() - lastTelemetryPub >= 1000 && !isCalibrating) {
    readAllSensors();
    publishTelemetry();
    displayReadings();
    lastTelemetryPub = millis();
  }

  delay(10);
}

// ======================== WIFI & MQTT MANAGEMENT =========================
void setupWiFi() {
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 25) {
    delay(500);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n[WiFi] Connection Failed. Operating in offline sensor mode.");
  }
}

void reconnectMQTT() {
  while (!mqttClient.connected() && WiFi.status() == WL_CONNECTED) {
    Serial.print("[MQTT] Connecting to broker...");

    // FIX: client ID must stay under 23 characters for strict MQTT 3.1 brokers.
    // "ESP32-NODE-SRF-01" = 17 chars (was 25 chars before -> rc=2 rejection).
    String clientId = "ESP32-" + String(NODE_ID);

    // Last Will & Testament (LWT) for offline detection
    String willTopic = String(TOPIC_STATUS);
    String willMsg = "{\"nodeId\":\"" + String(NODE_ID) + "\",\"status\":\"offline\"}";

    if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS, willTopic.c_str(), 1, true, willMsg.c_str())) {
      Serial.println(" Connected!");

      // Publish Online status
      StaticJsonDocument<128> doc;
      doc["nodeId"] = NODE_ID;
      doc["status"] = "online";
      doc["ip"] = WiFi.localIP().toString();
      char buffer[128];
      serializeJson(doc, buffer);
      mqttClient.publish(TOPIC_STATUS, buffer, true);

      // Subscribe to command topics (Two-Way Communication)
      mqttClient.subscribe(TOPIC_CMD_CALIB);
      mqttClient.subscribe(TOPIC_CMD_CONFIG);
      Serial.printf("[MQTT] Subscribed to %s and %s\n", TOPIC_CMD_CALIB, TOPIC_CMD_CONFIG);
    } else {
      Serial.print(" Failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" Retrying in 3 seconds...");
      delay(3000);
    }
  }
}

// ======================== INBOUND MQTT HANDLER (TWO-WAY) =================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  message.trim();

  Serial.println("\n--------------------------------------------------");
  Serial.printf("[MQTT IN] Topic: %s\n[MQTT IN] Message: %s\n", topic, message.c_str());

  // 1. Remote Calibration Command
  if (String(topic) == TOPIC_CMD_CALIB) {
    // Accepts simple "CALIBRATE" or JSON {"command":"CALIBRATE"}
    if (message.equalsIgnoreCase("CALIBRATE") || message.indexOf("CALIBRATE") >= 0) {
      Serial.println("[REMOTE] Received Calibration Command via MQTT!");
      calibrateAll();
    }
  }

  // 2. Dynamic Threshold Configuration
  if (String(topic) == TOPIC_CMD_CONFIG) {
    StaticJsonDocument<256> doc;
    DeserializationError error = deserializeJson(doc, message);
    if (!error) {
      if (doc.containsKey("gasThreshold"))  MQ135_GAS_THRESHOLD = doc["gasThreshold"];
      if (doc.containsKey("vibThreshold"))  VIBRATION_CRIT_THRES = doc["vibThreshold"];
      if (doc.containsKey("ldrDrop"))       LDR_THRESHOLD_DROP = doc["ldrDrop"];
      Serial.println("[CONFIG] Thresholds updated dynamically from dashboard!");
    }
  }
  Serial.println("--------------------------------------------------\n");
}

// ======================== CALIBRATION ROUTINE ============================
void calibrateAll() {
  isCalibrating = true;
  digitalWrite(LED_STATUS, HIGH);

  Serial.println("\n==================================================");
  Serial.println("  STARTING ZERO-OFFSET BASELINE CALIBRATION (10s)");
  Serial.println("==================================================");

  // 1. MPU6500 Vibration baseline
  Serial.println("[1/4] Calibrating MPU6500 (Vibration)...");
  float sumVib = 0;
  for (int i = 0; i < 50; i++) {
    readMPU6500();
    sumVib += vibration;
    delay(20);
  }
  baselineVibration = sumVib / 50.0;
  Serial.printf("   -> Baseline Vibration: %.2f%%\n", baselineVibration);

  // 2. DHT22 Temperature & Humidity baseline
  Serial.println("[2/4] Calibrating DHT22 (Temperature & Humidity)...");
  float tempSum = 0, humSum = 0;
  int count = 0;
  for (int i = 0; i < 10; i++) {
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t) && !isnan(h)) {
      tempSum += t;
      humSum += h;
      count++;
    }
    delay(400);
  }
  baselineTemp = (count > 0) ? (tempSum / count) : 25.0;
  baselineHumidity = (count > 0) ? (humSum / count) : 60.0;
  Serial.printf("   -> Baseline Temp: %.1f C, Humidity: %.1f%%\n", baselineTemp, baselineHumidity);

  // 3. LDR Photoresistor baseline
  Serial.println("[3/4] Calibrating LDR Photoresistor...");
  long ldrSum = 0;
  for (int i = 0; i < 20; i++) {
    ldrSum += analogRead(LDR_PIN);
    delay(50);
  }
  ldrBaseline = ldrSum / 20;
  Serial.printf("   -> Baseline Ambient Light: %d ADC\n", ldrBaseline);

  // 4. MQ135 Clean Air Calibration (R0 Estimation)
  Serial.println("[4/4] Calibrating MQ135 Gas Sensor...");
  float sensorSum = 0;
  for (int i = 0; i < 50; i++) {
    int raw = analogRead(MQ135_PIN);
    float vrl = ((float)raw / (float)ADC_MAX) * VCC;
    if (vrl > 0.01) {
      float rs = ((VCC - vrl) / vrl) * RL;
      sensorSum += rs;
    }
    delay(40);
  }
  float avgRs = sensorSum / 50.0;
  R0 = avgRs / 3.6; // Clean air ratio Rs/R0 approx 3.6 for MQ135
  if (R0 < 1000) R0 = 10000;
  Serial.printf("   -> Calculated MQ135 R0: %.2f Ohms\n", R0);

  isCalibrated = true;
  isCalibrating = false;
  digitalWrite(LED_STATUS, LOW);

  Serial.println("\nCalibration Complete! Publishing results to MQTT...\n");
  publishCalibrationResult();
}

// ======================== SENSOR READING ROUTINES ========================
void readAllSensors() {
  readMPU6500();
  readDHT22();
  readLDR();
  readMQ135();
  readPIR();
}

void readMPU6500() {
  Wire.beginTransmission(MPU6500_ADDR);
  Wire.write(0x3B); // Starting register for Accel X
  Wire.endTransmission(false);
  Wire.requestFrom((uint8_t)MPU6500_ADDR, (size_t)6, true);

  if (Wire.available() >= 6) {
    int16_t ax = Wire.read() << 8 | Wire.read();
    int16_t ay = Wire.read() << 8 | Wire.read();
    int16_t az = Wire.read() << 8 | Wire.read();

    float totalG = sqrt((float)ax * ax + (float)ay * ay + (float)az * az) / 16384.0;
    float rawDelta = abs(totalG - 1.0) * 100.0; // Deviation from 1G gravity
    vibration = abs(rawDelta - baselineVibration);
    if (vibration < 0) vibration = 0;
  }
}

void readDHT22() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  // Keep previous values if read failed
  if (!isnan(t)) baselineTemp = t;
  if (!isnan(h)) baselineHumidity = h;
}

void readLDR() {
  ldrValue = analogRead(LDR_PIN);
}

void readMQ135() {
  int raw = analogRead(MQ135_PIN);
  float vrl = ((float)raw / (float)ADC_MAX) * VCC;
  if (vrl > 0.05) {
    float rs = ((VCC - vrl) / vrl) * RL;
    float ratio = rs / R0;
    // Standard MQ135 curve: ppm = a * ratio^b (a ~ 116.6, b ~ -2.76)
    ppm = 116.602 * pow(ratio, -2.769);
    if (ppm < 0) ppm = 0;
    if (ppm > 2000) ppm = 2000;
  } else {
    ppm = 0;
  }
}

void readPIR() {
  pirState = digitalRead(PIR_PIN);
}

// ======================== MQTT PUBLISHING ================================
void publishTelemetry() {
  StaticJsonDocument<384> doc;
  doc["nodeId"]      = NODE_ID;
  doc["temp"]        = round(baselineTemp * 10.0) / 10.0;
  doc["humidity"]    = round(baselineHumidity * 10.0) / 10.0;
  doc["gas"]         = round(ppm * 10.0) / 10.0;
  doc["vibration"]   = round(vibration * 10.0) / 10.0;
  doc["light"]       = ldrValue;
  doc["motion"]      = pirState;
  doc["calibrated"]  = isCalibrated;

  // Determine status based on thresholds
  if (ppm >= MQ135_HAZARD_THRESHOLD || vibration >= VIBRATION_CRIT_THRES) {
    doc["status"] = "critical";
  } else if (ppm >= MQ135_GAS_THRESHOLD || vibration >= VIBRATION_WARN_THRES) {
    doc["status"] = "warning";
  } else {
    doc["status"] = "normal";
  }

  char buffer[384];
  serializeJson(doc, buffer);
  mqttClient.publish(TOPIC_TELEMETRY, buffer);
}

void publishCalibrationResult() {
  StaticJsonDocument<256> doc;
  doc["nodeId"]              = NODE_ID;
  doc["status"]              = "calibrated";
  doc["baselineVibration"]   = round(baselineVibration * 10.0) / 10.0;
  doc["baselineTemp"]        = round(baselineTemp * 10.0) / 10.0;
  doc["baselineHumidity"]    = round(baselineHumidity * 10.0) / 10.0;
  doc["baselineLdr"]         = ldrBaseline;
  doc["R0"]                  = round(R0);

  char buffer[256];
  serializeJson(doc, buffer);
  mqttClient.publish(TOPIC_CALIB_RES, buffer, true);
}

void displayReadings() {
  Serial.printf("[DATA] Temp: %.1f C | Hum: %.1f%% | Gas: %.1f ppm | Vib: %.1f%% | Light: %d | Motion: %s\n",
                baselineTemp, baselineHumidity, ppm, vibration, ldrValue, pirState ? "DETECTED" : "NONE");
}
