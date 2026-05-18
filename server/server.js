require('dotenv').config();
const mqtt = require('mqtt');
const { createClient } = require('@supabase/supabase-js');

// Inicjalizacja Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Połączenie z brokerem MQTT
const mqttClient = mqtt.connect(process.env.MQTT_URL, {
  clientId: `node-backend-${Math.random().toString(16).slice(2, 10)}`,
  clean: true,
  reconnectPeriod: 3000
});

const TOPIC_SUBSCRIBE = "+/+/#";

// Funkcje pomocnicze do parsowania tematów (zgodne z Twoim kodem z frontendu)
function firstSegment(topic) {
  const i = topic.indexOf("/");
  return i === -1 ? topic : topic.slice(0, i);
}

function deviceIdFromTopic(topic) {
  const seg = firstSegment(topic);
  const m = seg.match(/^(STM|ESP)_(.+)$/);
  return m ? m[2] : null;
}

function getSubTopic(topic) {
  const seg = firstSegment(topic);
  return topic.slice(seg.length + 1); // np. "max30102_bpm" lub "ds18b20_rom123"
}

// Bezpieczne parsowanie wartości (obsługuje surową liczbę lub JSON np. { "value": 12 })
function parsePayloadValue(payloadStr) {
  try {
    const parsed = JSON.parse(payloadStr);
    if (parsed && typeof parsed === 'object') {
      return parsed.value ?? parsed.bpm ?? parsed.spo2 ?? parsed.temp ?? null;
    }
    return parsed;
  } catch {
    const num = Number(payloadStr);
    return isNaN(num) ? null : num;
  }
}

// FUNKCJA FILTRUJĄCA - Sprawdza normy medyczne dla seniorów
function checkAlert(subTopic, value) {
  if (value === null || typeof value !== 'number') return null;

  // 1. Tętno (BPM)
  if (subTopic === 'max30102_bpm') {
    if (value < 50) return `Bradykardia - tętno za niskie (${value} ud./min)`;
    if (value > 100) return `Tachykardia - tętno za wysokie (${value} ud./min)`;
  }

  // 2. Saturacja (SpO2)
  if (subTopic === 'max30102_spo2') {
    if (value < 92) return `Hipoksja - krytycznie niska saturacja (${value}%)`;
  }

  // 3. Temperatura (Obsługuje dht11 oraz dynamiczne ds18b20_...)
  if (subTopic === 'dht11' || subTopic.startsWith('ds18b20_')) {
    if (value < 35.0) return `Hipotermia - skrajne wychłodzenie (${value}°C)`;
    if (value > 37.5) return `Gorączka / Przegrzanie (${value}°C)`;
  }

  return null; // Wszystko w normie
}

// Zapis alertu do bazy Supabase
async function saveAlertToSupabase(deviceId, sensor, value, message) {
  try {
    console.log(deviceId, sensor, value, message);
    const { data, error } = await supabase
      .from('alerts') // nazwa Twojej tabeli w Supabase
      .insert([
        {
        //   device_id: deviceId,
        //   sensor_type: sensor,
        //   reading_value: value,
          alert_type: message,
          created_at: new Date().toISOString()
        }
      ]);

    if (error) throw error;
    console.log(`🚨 ALERT ZAPISANY [Urządzenie: ${deviceId}] -> ${message}`);
  } catch (err) {
    console.error('Błąd zapisu do Supabase:', err.message);
  }
}

// Obsługa zdarzeń MQTT
mqttClient.on('connect', () => {
  console.log('✅ Połączono z brokerem MQTT. Rozpoczynam nasłuchiwanie...');
  mqttClient.subscribe(TOPIC_SUBSCRIBE, (err) => {
    if (err) console.error('Błąd subskrypcji MQTT:', err);
  });
});

mqttClient.on('message', async (topic, payloadBuf) => {
  const devId = deviceIdFromTopic(topic);
  if (!devId) return; // Wiadomość z nieznanego tematu

  const subTopic = getSubTopic(topic);
  const payloadStr = payloadBuf.toString();
  const value = parsePayloadValue(payloadStr);

  // Sprawdzamy czy wartość przekracza normy
  const alertMessage = checkAlert(subTopic, value);

  if (alertMessage) {
    // Jeśli wykryto anomalię, zapisujemy do Supabase
    await saveAlertToSupabase(devId, subTopic, value, alertMessage);
  }
});

mqttClient.on('error', (err) => {
  console.error('Błąd połączenia MQTT:', err);
});