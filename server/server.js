require('dotenv').config();
const mqtt = require('mqtt');
const { createClient } = require('@supabase/supabase-js');

const express = require('express');
const fs = require('fs');
const app = express();
app.use(express.json()); // Pozwala Node'owi rozumieć JSON z frontendu
const cors = require('cors');
const { subtle } = require('crypto');
app.use(cors()); 
const SETTINGS_FILE = './device_settings.json';
let deviceSettingsCache = {};
const LOCATION_INTERVAL = 60000; 
const ALERT_INTERVAL = 600000; 
const lastLocationSave = {};
const lastAlertSave = {};
const DEFAULT_SETTINGS = {
  isAccelometerData: true,
  isBodyTemperatureData: true,
  isHeartRateData: true,
  isSaturationData: true,
  isPanicButtonData: true,
  isLocationData: true
};

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const mqttClient = mqtt.connect(process.env.MQTT_URL, {
  clientId: `node-backend-${Math.random().toString(16).slice(2, 10)}`,
  clean: true,
  reconnectPeriod: 3000
});

const TOPIC_SUBSCRIBE = "+/+/#";

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
  return topic.slice(seg.length + 1); 
}

function parsePayloadValue(payloadStr) {
  try {
    const parsed = JSON.parse(payloadStr);
    
    if (parsed && typeof parsed === 'object') {
      if ('ax' in parsed || 'gx' in parsed) {
        return parsed;
      }
      
      return parsed.value ?? parsed.bpm ?? parsed.spo2 ?? parsed.temp ?? null;
    }
    return parsed;
  } catch {
    const num = Number(payloadStr);
    return isNaN(num) ? null : num;
  }
}


function locationFromNeo6m(payloadStr) {
  let o;
  try {
    o = JSON.parse(payloadStr);
  } catch {
    return null;
  }
  if (o && o.ok === false) return null;
  if (o.fix != null && String(o.fix) === "0") return null; // Brak fixa GPS - ignorujemy

  const lat = o.lat;
  const lng = o.lon != null ? o.lon : o.lng;
  if (lat == null || lng == null) return null;

  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;

  return { lat: la, lng: ln };
}

const accelHistory = {}; 

function detectFall(deviceId, ax, ay, az) {
  const totalG = Math.sqrt(ax*ax + ay*ay + az*az);
  
  if (!accelHistory[deviceId]) accelHistory[deviceId] = [];
  const history = accelHistory[deviceId];

  
  if (history.length > 10) history.shift();

  if (totalG >1.5) { // do testowania
    const hadFreeFall = history.some(reading => reading.totalG < 0.5 && (Date.now() - reading.ts < 2000));
    
    if (hadFreeFall) {
      history.push({ totalG, ts: Date.now() });
      return true;
    }
  }
  history.push({ totalG, ts: Date.now() });
  return false;
}

function checkAlert(subTopic, value, deviceId) {
  if (value === null ) return [null, null];
  if (subTopic === 'max30102_bpm' ) {
    if (value < 50) return [`Tętno za niskie (${value} ud./min)`, "isHeartRateData"];
    if (value > 150) return [`Tętno za wysokie (${value} ud./min)`, "isHeartRateData"];
  }

  if (subTopic === 'max30102_spo2') {
    if (value < 90) return [`Hipoksja - krytycznie niska saturacja (${value}%)`, "isSaturationData"];
  }

  if (subTopic === 'dht11' || subTopic.startsWith('ds18b20_')) {
    if (value < 31.0) return [`Skrajne wychłodzenie (${value}°C)`, "isBodyTemperatureData"];
    if (value > 39.0) return [`Gorączka / Przegrzanie (${value}°C)`, "isBodyTemperatureData"];
  }

  if(subTopic === 'button') {
    if (value === 1) return [`Naciśnięto przycisk SOS!`, "isPanicButtonData"];
  }
  
  if(subTopic === 'mpu6050') {
    let fall = detectFall(deviceId, value.ax, value.ay, value.az);
    if (fall) return [`Możliwy upadek wykryty!`, "isAccelometerData"];
  }

  return [null, null];
}




async function saveAlertToSupabase(deviceId, sensor, value, message) {
  if (Date.now() - lastAlertSave[sensor] < ALERT_INTERVAL) {
    return; 
  }
  if (!deviceSettingsCache[deviceId][sensor]) {
    return;
  }
  try {
    const { error } = await supabase
      .from('alerts') 
      .insert([
        {
          alert_type: sensor,
          message: message,
          created_at: new Date().toISOString()
        }
      ]);
    lastAlertSave[sensor] = Date.now();

    if (error) throw error;
    console.log(`🚨 ALERT ZAPISANY [Urządzenie: ${deviceId}] -> ${message}`);
  } catch (err) {
    console.error('Błąd zapisu alertu do Supabase:', err.message);
  }
}


async function saveLocationToSupabase(deviceId, lat, lng) {
  try {
    const { error } = await supabase
      .from('locations')
      .insert([
        {
          device_id: deviceId,
          latitude: lat,
          longitude: lng,
          created_at: new Date().toISOString()
        }
      ]);

    if (error) throw error;
    console.log(`📍 LOKALIZACJA ZAPISANA [Urządzenie: ${deviceId}] -> Lat: ${lat}, Lng: ${lng}`);
  } catch (err) {
    console.error('Błąd zapisu lokalizacji do Supabase:', err.message);
  }
}

mqttClient.on('connect', () => {
  console.log('✅ Połączono z brokerem MQTT. Rozpoczynam nasłuchiwanie...');
  mqttClient.subscribe(TOPIC_SUBSCRIBE, (err) => {
    if (err) console.error('Błąd subskrypcji MQTT:', err);
  });
});

mqttClient.on('message', async (topic, payloadBuf) => {
  const devId = deviceIdFromTopic(topic);
  if (!devId) return; 

  const subTopic = getSubTopic(topic);
  const payloadStr = payloadBuf.toString();

  if (subTopic === 'neo6m' && deviceSettingsCache[devId]?.isLocationData !== false) {
    const now = Date.now();
    const lastSave = lastLocationSave[devId] || 0;

    if (now - lastSave >= LOCATION_INTERVAL) {
      const loc = locationFromNeo6m(payloadStr);
      
      if (loc) {
        await saveLocationToSupabase(devId, loc.lat, loc.lng);
        lastLocationSave[devId] = now; 
      }
    } else {
    }
    return; 
  }


  const value = parsePayloadValue(payloadStr);
  const [alertMessage, alertType] = checkAlert(subTopic, value, devId);
  if (alertMessage) {
    await saveAlertToSupabase(devId, alertType, value, alertMessage);
  }
});
mqttClient.on('error', (err) => {
  console.error('Błąd połączenia MQTT:', err);
});



if (fs.existsSync(SETTINGS_FILE)) {
  try {
    deviceSettingsCache = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    console.log('Załadowano ustawienia urządzeń z lokalnego pliku JSON.');
  } catch (err) {
    console.error('Błąd czytania pliku ustawień, startuję z pustym cache:', err.message);
  }
}

app.get('/api/settings/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  console.log(`📡 Otrzymano żądanie ustawień dla urządzenia: ${deviceId}`);
  const settings = deviceSettingsCache[deviceId] || DEFAULT_SETTINGS;
  res.json(settings);
  console.log(`📤 Wysłano ustawienia dla ${deviceId}:`, settings);
});

app.post('/api/settings/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  const newSettings = req.body; // Frontend przysyła np. { isLocationData: false }

  deviceSettingsCache[deviceId] = {
    ...(deviceSettingsCache[deviceId] || DEFAULT_SETTINGS),
    ...newSettings
  };

  // Zapisujemy na dysku, żeby przetrwało restart serwera
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(deviceSettingsCache, null, 2));
    console.log(`💾 Zapisano nowe ustawienia dla ${deviceId} do pliku JSON.`);
    res.json({ success: true, settings: deviceSettingsCache[deviceId] });
  } catch (err) {
    console.error('Błąd zapisu do pliku:', err.message);
    res.status(500).json({ error: 'Nie udało się zapisać ustawień na serwerze' });
  }
});

// Uruchomienie serwera HTTP obok MQTT
app.listen(3000, () => {
  console.log('🚀 Serwer API dla frontendu działa na porcie 3000');
});