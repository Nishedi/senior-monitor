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

## Plik konfiguracyjny — anonimowy dostęp, port 1883

Plik mosquitto.conf:

```
persistence true
persistence_location /var/lib/mosquitto/

log_dest file /var/log/mosquitto/mosquitto.log

listener 1883
allow_anonymous true
```

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
sudo ufw enable
sudo ufw status
```