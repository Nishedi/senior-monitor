"""
Jednorazowa publikacja MQTT — topic i treść ustawiasz poniżej jako stringi.
Wymaga: pip install paho-mqtt
"""
import sys

import paho.mqtt.client as mqtt

# =============================================================================
# KONFIGURACJA — edytuj topic i treść wiadomości
# =============================================================================

MQTT_HOST = "72.60.33.184"
MQTT_PORT = 1883

# MQTT_TOPIC = "ESP_001/red_led/off"
MQTT_TOPIC = "ESP_001/buzzer"
# MQTT_TOPIC = "ESP_001/red_led/on"
# MQTT_TOPIC = "ESP_001/green_led/off"
# MQTT_TOPIC = "ESP_001/green_led/on"

MQTT_PAYLOAD = "100"

# QoS: 0 = najwięcej „best effort”, 1 = przynajmniej raz
MQTT_QOS = 0

CLIENT_ID = "sender_cli"

# =============================================================================


def main() -> None:
    client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2,
        client_id=CLIENT_ID,
    )

    body = MQTT_PAYLOAD.encode("utf-8")

    print(f"Łączenie z {MQTT_HOST}:{MQTT_PORT} …")
    try:
        client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
    except OSError as e:
        print("Błąd połączenia:", e, file=sys.stderr)
        sys.exit(1)

    client.loop_start()
    try:
        info = client.publish(MQTT_TOPIC, body, qos=MQTT_QOS)
        info.wait_for_publish(timeout=10)
        print(f"Wysłano: topic={MQTT_TOPIC!r} payload={MQTT_PAYLOAD!r}")
    except Exception as e:
        print("Błąd publikacji:", e, file=sys.stderr)
        sys.exit(1)
    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
