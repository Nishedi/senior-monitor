import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient"; // Twój klient Supabase

const AlertsMonitor = ({ deviceId = "001" }) => {
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Funkcja pomocnicza: zostawia tylko najnowszy alert dla każdego alert_type
  const filterLatestAlerts = (alertsArray) => {
    const seenTypes = new Set();
    const uniqueAlerts = [];

    for (const alert of alertsArray) {
      // Ponieważ tablica jest posortowana od najnowszych, 
      // pierwszy napotkany alert danego typu jest tym najnowszym
      if (!seenTypes.has(alert.alert_type)) {
        seenTypes.add(alert.alert_type);
        uniqueAlerts.push(alert);
      }
    }
    return uniqueAlerts;
  };

  // 1. POBIERANIE Z BAZY
  const fetchUnconfirmedAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("confirmed", false)
        .order("created_at", { ascending: false }); // Najnowsze na górze

      if (error) throw error;

      // Filtrujemy, żeby mieć tylko po jednym alercie z każdego typu
      const filteredData = filterLatestAlerts(data);
      setActiveAlerts(filteredData);
    } catch (err) {
      console.error("Błąd pobierania alertów:", err.message);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchUnconfirmedAlerts();

    const intervalId = setInterval(() => {
      fetchUnconfirmedAlerts();
    }, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, [deviceId]);

  const handleConfirmAlert = async (alertId,alert_type) => {
    try {
      const { error } = await supabase
        .from("alerts")
        .update({ confirmed: true })
        .eq("alert_type", alert_type);

      if (error) throw error;

      setActiveAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
    } catch (err) {
      console.error("Nie udało się potwierdzić alertu:", err.message);
    }
  };

  if (loading) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%", maxWidth: "450px", margin: "0 auto" }}>
      {activeAlerts.map((alert) => (
        <div
          key={alert.id}
          style={{
            border: "2px solid #dc3545",
            borderRadius: 8,
            padding: "0.75rem 0.85rem",
            background: "#fff5f5",
            boxShadow: "0 4px 6px rgba(220, 53, 69, 0.1)",
            transition: "all 0.2s ease",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#b21f2d", display: "flex", alignItems: "center", gap: "4px" }}>
              🚨 ZAGROŻENIE
            </div>
            <span style={{ fontSize: "0.75rem", color: "#6c757d" }}>
              {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div style={{ fontSize: "1.05rem", color: "#212529", marginBottom: "0.75rem", fontWeight: "500" }}>
            {alert.message}
          </div>

          <button
            onClick={() => handleConfirmAlert(alert.id, alert.alert_type)}
            style={{
              width: "100%",
              padding: "0.6rem 1rem",
              background: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontWeight: "600",
              fontSize: "0.95rem",
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => (e.target.style.background = "#bd2130")}
            onMouseLeave={(e) => (e.target.style.background = "#dc3545")}
          >
            Potwierdzam / Rozumiem stan
          </button>
        </div>
      ))}
      {activeAlerts.length === 0 && (
        <div style={{ textAlign: "center", color: "#6c757d", fontSize: "0.9rem" }}>
          Brak aktywnych alertów
        </div>
      )}
    </div>
  );
};

export default AlertsMonitor;