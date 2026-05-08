"""
ESP32 — agregacja czujników + MQTT (STM_<id>/<czujnik>).
Sterowanie diodami: subskrypcja ESP_<id>/red_led|green_led / on|off (payload dowolny).
Diody: GPIO → rezystor → GND, stan 1 = świeci.
Przycisk GPIO7: pull-up, zwarcie do GND = wciśnięty; MQTT co INTERVAL_BUTTON_MS → STM_<id>/button.
MPU6050 (I2C): INTERVAL_MPU6050_MS → STM_<id>/mpu6050 (JSON: ax,ay,az,gx,gy,gz,temp).
DHT11 GPIO6: INTERVAL_DHT11_MS → STM_<id>/dht11 (JSON: temp, hum).
KY-037 (analog A0): INTERVAL_KY037_MS → STM_<id>/ky037 (JSON: raw = siła z ADC).
Subskrypcja ESP_<id>/buzzer — payload = czas brzęczenia w ms (GPIO1, stan wysoki).
Błąd odczytu: ten sam temat co zwykły pomiar, payload JSON {"ok": false, "error": "...", "errno": opcjonalnie}.
Wymaga: MicroPython z umqtt.simple, onewire, ds18x20, dht.
"""
import gc
import json
import machine
import network
import time
import ubinascii
from machine import ADC, I2C, Pin

from umqtt.simple import MQTTClient

# ===================== KONFIGURACJA =====================

# Identyfikator urządzenia w topicach: STM_<STM_DEVICE_ID>/...
STM_DEVICE_ID = "001"

WIFI_SSID = "SoftwareHouse_24"
WIFI_PASSWORD = "JebacZmieniaczy#chujwamwoko69"

MQTT_HOST = "72.60.33.184"
MQTT_PORT = 1883
# allow_anonymous — bez loginu/hasła do brokera

# Okresy odczytu/wysyłki (ms) — niezależne dla każdego „źródła”
INTERVAL_DS18B20_MS = 1000
INTERVAL_SW520D_MS = 500
INTERVAL_BUTTON_MS = 500
INTERVAL_MAX30102_PUBLISH_MS = 500
INTERVAL_MPU6050_MS = 500
INTERVAL_DHT11_MS = 1000
INTERVAL_KY037_MS = 500
# MAX30102 musi być próbkowany często (algorytm BPM); osobno od publikacji MQTT
MAX30102_SAMPLE_MS = 30

# Piny (jak w skryptach tmp/)
PIN_DS18B20 = 2
PIN_SW520D = 3
PIN_I2C_SCL = 5
PIN_I2C_SDA = 4
# MPU6050 (ta sama magistrala co MAX30102); AD0→3V3 → 0x69
MPU6050_ADDR = 0x68

PIN_LED_GREEN = 10
PIN_LED_RED = 8
PIN_BUTTON = 7
PIN_DHT11 = 6
# KY-037 wyjście A0 → ADC (ESP32: GPIO0 = ADC1_CH0). GPIO0 bywa strap — sprawdź bootloader.
PIN_KY037_ADC = 0
# Buzzer z generatorem — zasilanie z GPIO (stan wysoki = dźwięk)
PIN_BUZZER = 1

# Wyłączanie czujników (False = pomiń inicjalizację i pętlę)
ENABLE_DS18B20 = True
ENABLE_SW520D = True
ENABLE_MAX30102 = True
ENABLE_MPU6050 = True
ENABLE_BUTTON = True
ENABLE_DHT11 = True
ENABLE_KY037 = True

# ===================== MQTT / WiFi =====================


def topic(sensor_name: str) -> str:
    return "STM_{0}/{1}".format(STM_DEVICE_ID, sensor_name)


def mqtt_read_failed(exc) -> str:
    """JSON na MQTT gdy odczyt czujnika się nie powiódł."""
    d = {"ok": False, "error": str(exc)}
    errn = getattr(exc, "errno", None)
    if errn is not None:
        d["errno"] = errn
    return json.dumps(d)


def esp_led_topic_base() -> str:
    return "ESP_{0}".format(STM_DEVICE_ID)


def subscribe_led_topics(client: MQTTClient) -> None:
    b = esp_led_topic_base()
    for suffix in ("/red_led/on", "/red_led/off", "/green_led/on", "/green_led/off"):
        client.subscribe(b + suffix)
    client.subscribe(b + "/buzzer")


def wifi_connect(timeout_s: float = 15.0) -> bool:
    wlan = network.WLAN(network.STA_IF)
    wlan.active(False)
    time.sleep_ms(200)
    wlan.active(True)
    wlan.connect(WIFI_SSID, WIFI_PASSWORD)
    t0 = time.time()
    while not wlan.isconnected():
        if time.time() - t0 > timeout_s:
            print("WiFi: timeout")
            return False
        time.sleep_ms(200)
    print("WiFi OK:", wlan.ifconfig())
    return True


def make_mqtt_client() -> MQTTClient:
    uid = ubinascii.hexlify(machine.unique_id()).decode()
    cid = "esp32_" + uid
    return MQTTClient(cid, MQTT_HOST, port=MQTT_PORT)


# ===================== MAX30102 (fragment logiki z tmp/MAX30102.py) =====================

ADDR = 0x57
REG_FIFO_DATA = 0x07
REG_MODE_CONFIG = 0x09
REG_SPO2_CONFIG = 0x0A
REG_LED1_PA = 0x0C
REG_LED2_PA = 0x0D
REG_FIFO_CONFIG = 0x08
REG_FIFO_WR_PTR = 0x04
REG_OVF_COUNTER = 0x05
REG_FIFO_RD_PTR = 0x06

WINDOW = 5
MIN_INTERVAL = 300


class Max30102Driver:
    def __init__(self, i2c: I2C):
        self.i2c = i2c
        self.ir_buf = []
        self.smooth_buf = []
        self.bpm_list = []
        self.last_peak_time = 0
        self.bpm = 0.0
        self.spo2 = 0.0

    def _write(self, reg: int, val: int) -> None:
        self.i2c.writeto_mem(ADDR, reg, bytes([val]))

    def _read(self, reg: int, n: int = 1):
        return self.i2c.readfrom_mem(ADDR, reg, n)

    def init(self) -> None:
        self._write(REG_MODE_CONFIG, 0x40)
        time.sleep_ms(100)
        self._write(REG_FIFO_CONFIG, 0x0F)
        self._write(REG_MODE_CONFIG, 0x03)
        self._write(REG_SPO2_CONFIG, 0x27)
        self._write(REG_LED1_PA, 0x24)
        self._write(REG_LED2_PA, 0x24)
        self._write(REG_FIFO_WR_PTR, 0)
        self._write(REG_OVF_COUNTER, 0)
        self._write(REG_FIFO_RD_PTR, 0)

    def read_sample(self):
        d = self._read(REG_FIFO_DATA, 6)
        red = ((d[0] << 16) | (d[1] << 8) | d[2]) & 0x3FFFF
        ir = ((d[3] << 16) | (d[4] << 8) | d[5]) & 0x3FFFF
        return red, ir

    def tick(self) -> None:
        red, ir = self.read_sample()
        t = time.ticks_ms()

        self.ir_buf.append(ir)
        if len(self.ir_buf) > WINDOW:
            self.ir_buf.pop(0)

        smooth = sum(self.ir_buf) / len(self.ir_buf)
        self.smooth_buf.append(smooth)
        if len(self.smooth_buf) > 50:
            self.smooth_buf.pop(0)

        if len(self.smooth_buf) > 3:
            prev = self.smooth_buf[-2]
            if prev > self.smooth_buf[-3] and prev > self.smooth_buf[-1]:
                threshold = sum(self.smooth_buf) / len(self.smooth_buf)
                if prev > threshold:
                    now = t
                    dt = time.ticks_diff(now, self.last_peak_time)
                    if dt > MIN_INTERVAL:
                        if self.last_peak_time != 0:
                            bpm_inst = 60000 / dt
                            if 40 < bpm_inst < 180:
                                self.bpm_list.append(bpm_inst)
                                if len(self.bpm_list) > 5:
                                    self.bpm_list.pop(0)
                                self.bpm = sum(self.bpm_list) / len(self.bpm_list)
                        self.last_peak_time = now

        if len(self.smooth_buf) > 20:
            ir_ac = max(self.smooth_buf) - min(self.smooth_buf)
            ir_dc = sum(self.smooth_buf) / len(self.smooth_buf)
            red_ac = ir_ac
            red_dc = ir_dc
            if ir_ac > 0 and ir_dc > 0:
                ratio = (red_ac / red_dc) / (ir_ac / ir_dc)
                self.spo2 = 110 - 25 * ratio
            else:
                self.spo2 = 0.0
        else:
            self.spo2 = 0.0


# ===================== MPU6050 (współdzielone I2C z MAX30102) =====================

MPU_REG_PWR_MGMT_1 = 0x6B
MPU_REG_DATA = 0x3B
MPU_ACCEL_LSB_PER_G = 16384.0
MPU_GYRO_LSB_PER_DPS = 131.0


def _mpu_i16(hi: int, lo: int) -> int:
    v = (hi << 8) | lo
    return v - 65536 if v >= 0x8000 else v


class MPU6050Reader:
    def __init__(self, i2c: I2C, addr: int = MPU6050_ADDR):
        self.i2c = i2c
        self.addr = addr

    def init(self) -> None:
        self.i2c.writeto_mem(self.addr, MPU_REG_PWR_MGMT_1, b"\x00")
        time.sleep_ms(10)

    def read_json_payload(self) -> str:
        raw = self.i2c.readfrom_mem(self.addr, MPU_REG_DATA, 14)
        ax = _mpu_i16(raw[0], raw[1])
        ay = _mpu_i16(raw[2], raw[3])
        az = _mpu_i16(raw[4], raw[5])
        t_raw = _mpu_i16(raw[6], raw[7])
        gx = _mpu_i16(raw[8], raw[9])
        gy = _mpu_i16(raw[10], raw[11])
        gz = _mpu_i16(raw[12], raw[13])
        d = {
            "ax": round(ax / MPU_ACCEL_LSB_PER_G, 4),
            "ay": round(ay / MPU_ACCEL_LSB_PER_G, 4),
            "az": round(az / MPU_ACCEL_LSB_PER_G, 4),
            "gx": round(gx / MPU_GYRO_LSB_PER_DPS, 2),
            "gy": round(gy / MPU_GYRO_LSB_PER_DPS, 2),
            "gz": round(gz / MPU_GYRO_LSB_PER_DPS, 2),
            "temp": round(t_raw / 340.0 + 36.53, 2),
        }
        return json.dumps(d)


# ===================== DS18B20 — maszyna stanów (bez blokowania 750 ms) =====================


class DS18B20Publisher:
    def __init__(self, pin_num: int, interval_ms: int, publish_fn):
        self.interval_ms = interval_ms
        self.publish_fn = publish_fn
        dat = Pin(pin_num, Pin.OPEN_DRAIN, Pin.PULL_UP)
        import onewire
        import ds18x20

        self._ds = ds18x20.DS18X20(onewire.OneWire(dat))
        self._roms = self._ds.scan()
        print("DS18B20 ROMs:", self._roms)
        self._phase = "idle"
        self._convert_start = 0
        # Pierwszy pomiar możliwy od razu; kolejne co interval_ms
        self._last_done = time.ticks_add(time.ticks_ms(), -self.interval_ms)

    def poll(self, now: int) -> None:
        if not self._roms:
            return
        if self._phase == "idle":
            if time.ticks_diff(now, self._last_done) >= self.interval_ms:
                try:
                    self._ds.convert_temp()
                except Exception as e:
                    print("DS18B20 convert err:", e)
                    self.publish_fn("ds18b20", mqtt_read_failed(e))
                    self._last_done = now
                    return
                self._convert_start = now
                self._phase = "waiting"
        elif self._phase == "waiting":
            if time.ticks_diff(now, self._convert_start) >= 750:
                for rom in self._roms:
                    try:
                        temp = self._ds.read_temp(rom)
                        suffix = ubinascii.hexlify(rom).decode()
                        name = "ds18b20_" + suffix
                        self.publish_fn(name, "{:.2f}".format(temp))
                    except Exception as e:
                        print("DS18B20 read err:", e)
                        name = "ds18b20_" + ubinascii.hexlify(rom).decode()
                        self.publish_fn(name, mqtt_read_failed(e))
                self._phase = "idle"
                self._last_done = now


# ===================== main =====================


def main() -> None:
    led_red = Pin(PIN_LED_RED, Pin.OUT, value=0)
    led_green = Pin(PIN_LED_GREEN, Pin.OUT, value=0)
    buzzer_pin = Pin(PIN_BUZZER, Pin.OUT, value=0)
    buzzer_until_ms = None

    mq = make_mqtt_client()
    max_driver = None
    mpu_reader = None
    ds_pub = None
    sw_pin = None
    btn_pin = None
    dht_sensor = None
    adc_mic = None

    def mqtt_on_led_command(topic_b, _msg) -> None:
        nonlocal buzzer_until_ms
        try:
            t = topic_b.decode()
        except AttributeError:
            t = str(topic_b)
        b = esp_led_topic_base()
        if t == b + "/red_led/on":
            led_red.value(1)
        elif t == b + "/red_led/off":
            led_red.value(0)
        elif t == b + "/green_led/on":
            led_green.value(1)
        elif t == b + "/green_led/off":
            led_green.value(0)
        elif t == b + "/buzzer":
            try:
                ms = int((_msg or b"0").decode().strip())
            except (ValueError, AttributeError):
                ms = 0
            if ms < 0:
                ms = 0
            if ms > 60000:
                ms = 60000
            buzzer_pin.value(1)
            buzzer_until_ms = time.ticks_add(time.ticks_ms(), ms)

    mq.set_callback(mqtt_on_led_command)

    def publish_sensor(sensor_name: str, payload: str) -> None:
        try:
            mq.publish(topic(sensor_name), payload.encode())
        except OSError as e:
            print("MQTT publish error:", e, "— reconnect")
            try:
                mq.connect()
                subscribe_led_topics(mq)
                mq.publish(topic(sensor_name), payload.encode())
            except Exception as e2:
                print("MQTT reconnect failed:", e2)

    if not wifi_connect():
        return

    try:
        mq.connect()
        subscribe_led_topics(mq)
        print("MQTT połączono:", MQTT_HOST, MQTT_PORT)
        print("LED:", esp_led_topic_base() + "/red_led|green_led/(on|off)")
        print("Buzzer:", esp_led_topic_base() + "/buzzer → payload ms")
    except Exception as e:
        print("MQTT connect failed:", e)
        return

    i2c = None
    if ENABLE_MAX30102 or ENABLE_MPU6050:
        try:
            i2c = I2C(
                0,
                scl=Pin(PIN_I2C_SCL),
                sda=Pin(PIN_I2C_SDA),
                freq=100000,
            )
            print("I2C OK:", [hex(a) for a in i2c.scan()])
        except Exception as e:
            print("I2C init failed:", e)
            i2c = None

    if i2c is not None and ENABLE_MAX30102:
        try:
            max_driver = Max30102Driver(i2c)
            max_driver.init()
            print("MAX30102 OK")
        except Exception as e:
            print("MAX30102 wyłączony (błąd):", e)
            max_driver = None

    if i2c is not None and ENABLE_MPU6050:
        try:
            if MPU6050_ADDR not in i2c.scan():
                raise OSError("brak MPU6050 pod " + hex(MPU6050_ADDR))
            mpu_reader = MPU6050Reader(i2c, MPU6050_ADDR)
            mpu_reader.init()
            print("MPU6050 OK")
        except Exception as e:
            print("MPU6050 wyłączony (błąd):", e)
            mpu_reader = None

    if ENABLE_DS18B20:
        try:
            ds_pub = DS18B20Publisher(PIN_DS18B20, INTERVAL_DS18B20_MS, publish_sensor)
        except Exception as e:
            print("DS18B20 wyłączony (błąd):", e)
            ds_pub = None

    if ENABLE_SW520D:
        sw_pin = Pin(PIN_SW520D, Pin.IN, Pin.PULL_UP)

    if ENABLE_BUTTON:
        btn_pin = Pin(PIN_BUTTON, Pin.IN, Pin.PULL_UP)

    if ENABLE_DHT11:
        try:
            import dht

            dht_sensor = dht.DHT11(Pin(PIN_DHT11))
            print("DHT11 OK GPIO", PIN_DHT11)
        except Exception as e:
            print("DHT11 wyłączony (błąd):", e)
            dht_sensor = None

    if ENABLE_KY037:
        try:
            _adc = ADC(Pin(PIN_KY037_ADC))
            _adc.atten(ADC.ATTN_11DB)
            _adc.width(ADC.WIDTH_12BIT)
            adc_mic = _adc
            print("KY-037 OK GPIO", PIN_KY037_ADC)
        except Exception as e:
            print("KY-037 wyłączony (błąd):", e)
            adc_mic = None

    t_last_max_sample = time.ticks_ms()
    t_last_max_pub = time.ticks_ms()
    t_last_sw = time.ticks_ms()
    t_last_btn = time.ticks_ms()
    t_last_mpu = time.ticks_ms()
    t_last_dht = time.ticks_ms()
    t_last_ky037 = time.ticks_ms()

    while True:
        now = time.ticks_ms()

        if buzzer_until_ms is not None:
            if time.ticks_diff(now, buzzer_until_ms) >= 0:
                buzzer_pin.value(0)
                buzzer_until_ms = None

        if max_driver is not None:
            if time.ticks_diff(now, t_last_max_sample) >= MAX30102_SAMPLE_MS:
                try:
                    max_driver.tick()
                except Exception as e:
                    err = mqtt_read_failed(e)
                    publish_sensor("max30102_bpm", err)
                    publish_sensor("max30102_spo2", err)
                    print("MAX30102 tick:", e)
                t_last_max_sample = now
            if time.ticks_diff(now, t_last_max_pub) >= INTERVAL_MAX30102_PUBLISH_MS:
                try:
                    publish_sensor("max30102_bpm", "{:.1f}".format(max_driver.bpm))
                    publish_sensor("max30102_spo2", "{:.1f}".format(max_driver.spo2))
                except Exception as e:
                    err = mqtt_read_failed(e)
                    publish_sensor("max30102_bpm", err)
                    publish_sensor("max30102_spo2", err)
                    print("MAX30102 publish:", e)
                t_last_max_pub = now

        if ds_pub is not None:
            ds_pub.poll(now)

        if sw_pin is not None and time.ticks_diff(now, t_last_sw) >= INTERVAL_SW520D_MS:
            try:
                publish_sensor("sw520d", str(sw_pin.value()))
            except Exception as e:
                publish_sensor("sw520d", mqtt_read_failed(e))
                print("SW520D:", e)
            t_last_sw = now

        if btn_pin is not None and time.ticks_diff(now, t_last_btn) >= INTERVAL_BUTTON_MS:
            try:
                publish_sensor("button", str(btn_pin.value()))
            except Exception as e:
                publish_sensor("button", mqtt_read_failed(e))
                print("button:", e)
            t_last_btn = now

        if mpu_reader is not None and time.ticks_diff(now, t_last_mpu) >= INTERVAL_MPU6050_MS:
            try:
                publish_sensor("mpu6050", mpu_reader.read_json_payload())
            except Exception as e:
                publish_sensor("mpu6050", mqtt_read_failed(e))
                print("MPU6050 read:", e)
            t_last_mpu = now

        if dht_sensor is not None and time.ticks_diff(now, t_last_dht) >= INTERVAL_DHT11_MS:
            try:
                dht_sensor.measure()
                payload = json.dumps(
                    {
                        "temp": dht_sensor.temperature(),
                        "hum": dht_sensor.humidity(),
                    }
                )
                publish_sensor("dht11", payload)
            except Exception as e:
                publish_sensor("dht11", mqtt_read_failed(e))
                print("DHT11 read:", e)
            t_last_dht = now

        if adc_mic is not None and time.ticks_diff(now, t_last_ky037) >= INTERVAL_KY037_MS:
            try:
                publish_sensor(
                    "ky037",
                    json.dumps({"raw": adc_mic.read()}),
                )
            except Exception as e:
                publish_sensor("ky037", mqtt_read_failed(e))
                print("KY-037 read:", e)
            t_last_ky037 = now

        try:
            mq.check_msg()
        except OSError as e:
            print("MQTT check_msg:", e)
            try:
                mq.connect()
                subscribe_led_topics(mq)
            except Exception as e2:
                print("MQTT reconnect:", e2)

        gc.collect()
        time.sleep_ms(5)


if __name__ == "__main__":
    main()
