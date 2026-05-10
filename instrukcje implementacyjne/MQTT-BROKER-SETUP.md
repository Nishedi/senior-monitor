# Konfiguracja brokera MQTT (Mosquitto) na serwerze Linux

Instrukcja zakłada **Ubuntu 22.04 LTS / Debian 12** (serwer VPS z publicznym adresem). Broker nasłuchuje na porcie **1883**, połączenia anonimowe włączone (`allow_anonymous true`), zgodnie z konfiguracją klienta ESP32.

> **Uwaga bezpieczeństwa:** anonimowy dostęp do MQTT nad publicznym Internetem jest wygodny na etapie rozwoju, ale pozwala każdemu publikować i subskrybować tematy na Twoim brokerze. Na produkcji wyłącz `allow_anonymous`, włącz uwierzytelnianie (hasła lub certyfikaty TLS na porcie 8883).



## Aktualizacja pakietów

```bash
sudo apt update
sudo apt upgrade -y
```

---

## Instalacja Mosquitto i narzędzi testowych

```bash
sudo apt install -y mosquitto mosquitto-clients
sudo systemctl status mosquitto
```

---

## Plik konfiguracyjny — MQTT (1883) + MQTT/WebSocket (9001)

Pełny przykład **`/etc/mosquitto/mosquitto.conf`** (ESP na **1883**, przeglądarka na **9001** przez `mqtt.js` → `ws://<HOST>:9001/mqtt`):

```
persistence true
persistence_location /var/lib/mosquitto/

log_dest file /var/log/mosquitto/mosquitto.log

# MQTT — ESP32 i inni klienci TCP
listener 1883
allow_anonymous true

# MQTT przez WebSocket — frontend w przeglądarce
listener 9001
protocol websockets
allow_anonymous true
```

(Opcjonalnie, jeśli broker nie wystawia WebSocket na zewnątrz: `bind_address 0.0.0.0` w bloku listenera **9001** — zwykle nie jest wymagane.)

---

Sprawdź składnię konfiguracji:

```bash
sudo mosquitto -c /etc/mosquitto/mosquitto.conf -v
```

Następnie:

```bash
sudo systemctl restart mosquitto
sudo systemctl enable mosquitto
```

---

## 6. Firewall (UFW)


```bash
sudo ufw allow OpenSSH
sudo ufw allow 1883/tcp
sudo ufw allow 9001/tcp
sudo ufw enable
sudo ufw status
```

---

## Przeglądarka (MQTT przez WebSocket)

Frontend (`pwa/`) łączy się przez **`mqtt.js`** z adresem **`ws://<HOST>:9001/mqtt`** — wymaga drugiego listenera (patrz pełny `mosquitto.conf` powyżej).

Po zmianach: `sudo systemctl restart mosquitto`. Sprawdź: `ss -tlnp | grep -E '1883|9001'`.