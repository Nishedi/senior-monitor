import React, { useEffect, useState } from "react";
import "./Settings.css";

// Podmień adres na IP swojego serwera Node.js (port 3000 z poprzedniego kroku)
// const API_BASE_URL = "http://72.60.33.184:3000/api/settings";
const API_BASE_URL = "http://localhost:3000/api/settings";

const Settings = ({ deviceId = "001" }) => {
  const [settings, setSettings] = useState({
    isAccelometerData: true,
    isBodyTemperatureData: true,
    isHeartRateData: true,
    isSaturationData: true,
    isPanicButtonData: true,
    isLocationData: true,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    fetch(`${API_BASE_URL}/${deviceId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Błąd serwera");
        return res.json();
      })
      .then((data) => {
        setSettings(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Nie udało się pobrać ustawień:", err);
        setIsLoading(false);
      });
  }, [deviceId]);

  const handleToggle = async (key) => {
    const currentValue = settings[key];
    const newValue = !currentValue;

    setSettings((prev) => ({ ...prev, [key]: newValue }));

    try {
      const response = await fetch(`${API_BASE_URL}/${deviceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: newValue }),
      });

      if (!response.ok) throw new Error("Serwer nie zapisał zmiany");
      
    } catch (err) {
      console.error("Błąd zapisu, przywracam poprzedni stan:", err);
      setSettings((prev) => ({ ...prev, [key]: currentValue }));
    }
  };

  if (isLoading) {
    return <div className="settings-loading">Ładowanie konfiguracji urządzenia...</div>;
  }

  return (
    <div className="settings-container">
      
      <div className="setting-row">
        <span className="setting-label">Dane z akcelerometru</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={settings.isAccelometerData}
            onChange={() => handleToggle("isAccelometerData")}
          />
          <span className="slider"></span>
        </label>
      </div>

      <div className="setting-row">
        <span className="setting-label">Dane z ciała (Temperatura)</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={settings.isBodyTemperatureData}
            onChange={() => handleToggle("isBodyTemperatureData")}
          />
          <span className="slider"></span>
        </label>
      </div>

      <div className="setting-row">
        <span className="setting-label">Dane z tętna</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={settings.isHeartRateData}
            onChange={() => handleToggle("isHeartRateData")}
          />
          <span className="slider"></span>
        </label>
      </div>

      <div className="setting-row">
        <span className="setting-label">Dane z saturacji</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={settings.isSaturationData}
            onChange={() => handleToggle("isSaturationData")}
          />
          <span className="slider"></span>
        </label>
      </div>

      <div className="setting-row">
        <span className="setting-label">Dane z przycisku paniki</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={settings.isPanicButtonData}
            onChange={() => handleToggle("isPanicButtonData")}
          />
          <span className="slider"></span>
        </label>
      </div>

      <div className="setting-row">
        <span className="setting-label">Dane z lokalizacji</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={settings.isLocationData}
            onChange={() => handleToggle("isLocationData")}
          />
          <span className="slider"></span>
        </label>
      </div>

    </div>
  );
};

export default Settings;