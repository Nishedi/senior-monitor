# Vite `npm run dev` jako usługa systemd

Krótka instrukcja, żeby frontend (**`npm run dev`**) po restarcie VPS uruchamiał się sam i działał w tle.

Zakładamy katalog projektu **`/root`** z `package.json` (jak w **`VPS-DEPLOYMENT.md`**). Jeśli masz inną ścieżkę — podmień ją w `WorkingDirectory` i w komendach.

---

## 1. Jednorazowo: zależności i build ścieżki

```bash
cd /root
npm install
which npm
```

Zapamiętaj ścieżkę z `which npm` (często `/usr/bin/npm`). Użyj jej w `ExecStart` poniżej.

---

## 2. Plik usługi

Utwórz plik **`/etc/systemd/system/senior-monitor-vite.service`**:

```ini
[Unit]
Description=Senior Monitor — Vite dev (npm run dev)
After=network.target

[Service]
Type=simple
WorkingDirectory=/root
ExecStart=/usr/bin/npm run dev
Restart=always
RestartSec=3
Environment=NODE_ENV=development

[Install]
WantedBy=multi-user.target
```

---

## 3. Pierwsze uruchomienie i autostart

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now senior-monitor-vite.service
sudo systemctl status senior-monitor-vite.service
```

---

## 4. Restart po zmianach w kodzie / konfiguracji

Po wgraniu nowych plików zwykle wystarczy odświeżyć przeglądarkę (HMR). Po zmianie **`vite.config.js`** lub gdy coś „zawiesza” dev server:

```bash
sudo systemctl restart senior-monitor-vite.service
```

---

## 5. Logi

```bash
journalctl -u senior-monitor-vite.service -f
```

(Ostatnie wpisy bez `-f`: usuń `-f`.)

---

## 6. Zatrzymanie / wyłączenie autostartu

```bash
sudo systemctl stop senior-monitor-vite.service
sudo systemctl disable senior-monitor-vite.service
```

---

**Uwaga:** `npm run dev` nadaje się do rozwoju i szybkiego podglądu. Docelowy hosting statyczny po **`npm run build`** opisz osobno (nginx/Caddy + katalog **`dist/`**).
