// src/App.js
import React, { useEffect, useState, useMemo } from "react";
import { io } from "socket.io-client";
import { Line } from "react-chartjs-2";
import "chart.js/auto";

import {
  FaTint,
  FaThermometerHalf,
  FaFlask,
  FaCloud,
  FaQuestionCircle,
  FaCheckCircle,
  FaTimesCircle,
} from "react-icons/fa";

// Read socket URL from environment
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL;

// Define sensors with icons and units
const METRICS = [
  { key: "ph",   icon: <FaTint />,            unit: "pH"   },
  { key: "temp", icon: <FaThermometerHalf />, unit: "°C"   },
  { key: "cod",  icon: <FaFlask />,           unit: "mg/L" },
  { key: "ss",   icon: <FaCloud />,           unit: "g/L"  },
];

export default function App() {
  // Persist theme choice in localStorage
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved === null ? true : saved === "true";
  });
  useEffect(() => {
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  const [devices, setDevices] = useState({});

  // Subscribe to MQTT messages via Socket.IO proxy
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socket.on("mqtt_message", ({ message }) => {
      let payload;
      try {
        payload = JSON.parse(message).payload;
      } catch {
        return;
      }
      const { id, name, fields } = payload;
      const latest = Array.isArray(fields) && fields.length ? fields[fields.length - 1] : {};

      setDevices(prev => {
        const prevHistory = prev[id]?.history || [];
        const entry = { time: new Date(latest.timestamp * 1000), data: latest };
        const history = [...prevHistory, entry].slice(-20);
        return {
          ...prev,
          [id]: {
            name,
            history,
            lastSeen: new Date(),
            status: "online",
          },
        };
      });
    });
    return () => socket.disconnect();
  }, []);

  // Offline detection
  useEffect(() => {
    const timer = setInterval(() => {
      setDevices(prev => {
        const now = Date.now();
        const updated = {};
        Object.entries(prev).forEach(([id, dev]) => {
          updated[id] = {
            ...dev,
            status: now - dev.lastSeen.getTime() > 30000 ? "offline" : "online",
          };
        });
        return updated;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const ids = Object.keys(devices);
  // Group and sort by OUI prefix then full MAC
  const sortedIds = useMemo(() => {
    return [...ids].sort((a, b) => {
      const ga = a.split(":").slice(0, 3).join(":"),
            gb = b.split(":").slice(0, 3).join(":");
      return ga === gb ? a.localeCompare(b) : ga.localeCompare(gb);
    });
  }, [ids]);

  const total   = ids.length;
  const online  = ids.filter(id => devices[id].status === "online").length;
  const offline = total - online;

  return (
    <div style={darkMode ? styles.appDark : styles.appLight}>
      <header style={styles.header}>
        <h1 style={darkMode ? styles.titleDark : styles.titleLight}>
          MQTT Devices Dashboard
        </h1>
        <button
          style={darkMode ? styles.themeButtonDark : styles.themeButtonLight}
          onClick={() => setDarkMode(prev => !prev)}
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? "Light Mode" : "Dark Mode"}
        </button>
      </header>

      <section style={styles.summary}>
        <SummaryCard
          label="Total Devices"
          value={total}
          darkMode={darkMode}
        />
        <SummaryCard
          label="Online"
          value={online}
          valueColor="#4caf50"
          darkMode={darkMode}
        />
        <SummaryCard
          label="Offline"
          value={offline}
          valueColor="#f44336"
          darkMode={darkMode}
        />
      </section>

      <main style={styles.grid}>
        {sortedIds.length === 0 ? (
          <p style={{ ...styles.waiting, color: darkMode ? "#aaa" : "#777" }}>
            Waiting for devices…
          </p>
        ) : (
          sortedIds.map(id => (
            <DeviceCard
              key={id}
              id={id}
              device={devices[id]}
              darkMode={darkMode}
            />
          ))
        )}
      </main>

      <footer style={styles.footerText}>
        &copy; {new Date().getFullYear()} ROCKSTAR Modern Control. All rights reserved.
      </footer>
    </div>
  );
}

// Small reusable summary card component
function SummaryCard({ label, value, valueColor, darkMode }) {
  return (
    <div
      style={{
        ...styles.summaryCard,
        background: darkMode ? "#2a2d36" : "#fff",
        color: darkMode ? "#fff" : "#333",
      }}
    >
      <span style={{
        ...styles.summaryNumber,
        color: valueColor ?? (darkMode ? "#fff" : "#333"),
      }}>
        {value}
      </span>
      <span style={styles.summaryLabel}>{label}</span>
    </div>
  );
}

// DeviceCard wrapped with React.memo for performance
const DeviceCard = React.memo(function DeviceCard({ id, device, darkMode }) {
  const { name, history, lastSeen, status } = device;
  const labels = history.map(h => h.time.toLocaleTimeString());
  const datasets = METRICS.map((m, i) => ({
    label: m.key.toUpperCase(),
    data: history.map(h => h.data[m.key] ?? null),
    fill: false,
    tension: 0.3,
    borderColor: ["#2196f3", "#ff9800", "#9c27b0", "#00bcd4"][i],
  }));
  const latest = history[history.length - 1]?.data || {};
  const latestTime = history[history.length - 1]?.time;

  return (
    <div
      style={{
        ...styles.card,
        background: darkMode ? "#2a2d36" : "#fff",
        color: darkMode ? "#fff" : "#333",
        borderColor: status === "online" ? "#4caf50" : "#f44336",
      }}
    >
      <div style={styles.cardHeader}>
        <div style={styles.icon}>
          {METRICS.find(m => m.key === id.split(":")[0])?.icon || <FaQuestionCircle />}
        </div>
        <div>
          <h2 style={styles.deviceName}>{name}</h2>
          <p style={styles.deviceId}>{id}</p>
        </div>
      </div>

      {latestTime && (
        <p style={{ ...styles.sensorTimestamp, color: darkMode ? "#ccc" : "#555" }}>
          {latestTime.toLocaleDateString()} {latestTime.toLocaleTimeString()}
        </p>
      )}

      <div style={styles.chart}>
        <Line
          data={{ labels, datasets }}
          options={{
            maintainAspectRatio: false,
            plugins: { legend: { position: "bottom" } },
            scales: { x: { display: false }, y: { beginAtZero: true } },
          }}
        />
      </div>

      <div style={styles.values}>
        {METRICS.map(m => (
          <div key={m.key} style={styles.valueRow}>
            <div style={styles.valueIcon}>{m.icon}</div>
            <div style={styles.valueLabel}>{m.key.toUpperCase()}</div>
            <div style={styles.valueData}>
              {latest[m.key] != null ? `${latest[m.key]} ${m.unit}` : "--"}
            </div>
          </div>
        ))}
      </div>

      <div style={styles.footer}>
        <span style={{ color: darkMode ? "#ccc" : "#555" }}>
          Last Seen: {lastSeen.toLocaleTimeString()}
        </span>
        <span style={{ marginLeft: 8 }}>
          {status === "online" ? <FaCheckCircle color="#4caf50" /> : <FaTimesCircle color="#f44336" />}
        </span>
      </div>
    </div>
  );
});

const styles = {
  appDark:   { fontFamily: "Roboto, sans-serif", background: "#181f2a", minHeight: "100vh", padding: "16px" },
  appLight:  { fontFamily: "Roboto, sans-serif", background: "#f5f5f5", minHeight: "100vh", padding: "16px" },
  header:    { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 16px", height: "60px" },
  titleDark: { color: "#fff", fontSize: "24px", fontWeight: 600, margin: 0 },
  titleLight:{ color: "#333", fontSize: "24px", fontWeight: 600, margin: 0 },
  themeButtonDark: { padding: "8px 12px", background: "#444", color: "#fff", border: "1px solid #555", borderRadius: "4px" },
  themeButtonLight:{ padding: "8px 12px", background: "#eee", color: "#333", border: "1px solid #ccc", borderRadius: "4px" },
  summary:     { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px", marginBottom: "32px" },
  summaryCard: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "12px 16px", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", flex: "1 1 100px", maxWidth: "120px" },
  summaryNumber:{ fontSize: "28px", fontWeight: 700, marginBottom: "4px" },
  summaryLabel:{ fontSize: "12px", opacity: 0.7, textTransform: "uppercase", textAlign: "center" },
  grid:        { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "24px" },
  waiting:     { textAlign: "center", marginTop: "80px" },
  card:        { border: "2px solid", borderRadius: "8px", boxShadow: "0 2px 12px rgba(0,0,0,0.1)", display: "flex", flexDirection: "column", padding: "16px" },
  cardHeader:  { display: "flex", alignItems: "center", marginBottom: "16px" },
  icon:        { fontSize: "32px", marginRight: "12px" },
  deviceName:  { margin: 0, fontSize: "18px" },
  deviceId:    { margin: 0, fontSize: "12px", opacity: 0.7 },
  sensorTimestamp:{ margin: "0 0 8px", fontSize: "12px" },
  chart:       { flex: 1, minHeight: "150px", marginBottom: "16px" },
  values:      { marginBottom: "16px" },
  valueRow:    { display: "flex", alignItems: "center", marginBottom: "8px" },
  valueIcon:   { width: "24px", textAlign: "center" },
  valueLabel:  { flex: 1, fontSize: "14px" },
  valueData:   { fontWeight: "600", fontSize: "14px" },
  footer:      { display: "flex", justifyContent: "space-between", fontSize: "12px", marginTop: "auto" },
  footerText:  { textAlign: "center", marginTop: "40px", fontSize: "12px", color: "#777" }
};
