# PWA (Vite) na VPS — pliki w `/root`

Zakładamy **Ubuntu / Debian**, projekt React jest **wgrany do `/root`** (np. zawartość `pwa/` po `scp`). Katalog `server/` w repozytorium zawiera głównie dokumentację — **nie ma tu osobnego backendu Node do `npm start`.**

**Broker MQTT (Mosquitto)** — jeśli go potrzebujesz na tej maszynie, instaluj i konfiguruj wyłącznie wg **`MQTT-BROKER-SETUP.md`** (tu nie powtarzamy kroków).

---

## 1. Wgranie plików z komputera (`scp`)

Z katalogu z projektem (dostosuj ścieżkę i użytkownika):

```bash
scp -r ./pwa/* root@<PUBLICZNY_IP>:/root/
```

Albo całe repo, potem na serwerze pracuj w katalogu, gdzie leży `package.json` Vite (u Ciebie: **`/root`**).

---

## 2. Node.js (jeśli brak)

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v && npm -v
```

---

## 3. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 5173/tcp
sudo ufw allow 9001/tcp
sudo ufw enable
```

Port **9001** — MQTT WebSocket dla przeglądarki (wg `MQTT-BROKER-SETUP.md`). Jeśli nie hostujesz strony na VPS, możesz pominąć **5173**.

---

## 4. Uruchomienie PWA w `/root`

```bash
cd /root
```


```bash
npm install
npm run dev
```