"""
Subskrybuje wszystkie tematy MQTT (#) i wypisuje topic + payload na konsolę.
Wymaga: pip install paho-mqtt
"""
import signal
import sys

import paho.mqtt.client as mqtt

# --- konfiguracja (jak w esp32/main.py) ---
MQTT_HOST = "72.60.33.184"
MQTT_PORT = 1883
# bez loginu — allow_anonymous na brokerze

CLIENT_ID = "total_reciever"


def on_connect(
    client: mqtt.Client,
    userdata,
    flags,
    reason_code,
    properties,
):
    if reason_code.is_failure:
        print("Połączenie odrzucone:", reason_code, file=sys.stderr)
        return
    print("Połączono z", MQTT_HOST, "— subskrypcja '#' (wszystkie tematy)")
    client.subscribe("#")


def on_message(client: mqtt.Client, userdata, msg: mqtt.MQTTMessage):
    try:
        payload = msg.payload.decode("utf-8")
    except UnicodeDecodeError:
        payload = repr(msg.payload)
    print(f"{msg.topic}\t{payload}")


def main() -> None:
    client = mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2,
        client_id=CLIENT_ID,
    )
    client.on_connect = on_connect
    client.on_message = on_message

    def shutdown(signum, frame):
        print("\nKończenie…")
        client.disconnect()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, shutdown)

    print(f"Łączenie z {MQTT_HOST}:{MQTT_PORT} …")
    client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
    client.loop_forever()


if __name__ == "__main__":
    main()
