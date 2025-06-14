// src/App.js
import React, { useEffect, useState } from "react";
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

// Read socket URL from environment (set in .env.development or Vercel)
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL;

// Icons per sensor key
const ICON_MAP = {
  ph: <FaTint />,
  temp: <FaThermometerHalf />,
  cod: <FaFlask />,
  ss: <FaCloud />,
};

export default function App() {
  const [devices, setDevices] = useState({});

  // Subscribe to MQTT messages via proxy
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
      const latest = Array.isArray(fields) && fields.length
        ? fields[fields.length - 1]
        : {};

      // Record history and include original timestamp
      setDevices(old => {
        const prevHistory = old[id]?.history || [];
        const entry = {
          time: new Date(latest.timestamp * 1000),  // use payload timestamp
          data: latest
        };
        const history = [...prevHistory, entry].slice(-20);
        return {
          ...old,
          [id]: {
            name,
            history,
            lastSeen: new Date(),  // last seen by proxy
            status: "online",
          },
        };
      });
    });

    return () => socket.disconnect();
  }, []);

  // Offline detection
  useEffect(() => {
    const interval = setInterval(() => {
      setDevices(old => {
        const now = Date.now();
        const updated = {};
        Object.entries(old).forEach(([id, dev]) => {
          updated[id] = {
            ...dev,
            status: now - dev.lastSeen.getTime() > 30000 ? "offline" : "online",
          };
        });
        return updated;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Summary counts
  const ids = Object.keys(devices);
  const total = ids.length;
  const onlineCount = ids.filter(id => devices[id].status === "online").length;
  const offlineCount = total - onlineCount;

  return (
    <div style={styles.app}>
      <h1 style={styles.header}>🌐 MQTT Devices Dashboard</h1>

      {/* Summary */}
      <div style={styles.summary}>
        <div style={styles.summaryItem}>
          <span style={styles.summaryNumber}>{total}</span>
          <span>Total Devices</span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryNumberOnline}>{onlineCount}</span>
          <span>Online</span>
        </div>
        <div style={styles.summaryItem}>
          <span style={styles.summaryNumberOffline}>{offlineCount}</span>
          <span>Offline</span>
        </div>
      </div>

      {/* Device Cards Grid */}
      <div style={styles.grid}>
        {ids.length === 0 && <p style={styles.waiting}>Waiting for devices…</p>}
        {ids.map(id => (
          <DeviceCard key={id} id={id} device={devices[id]} />
        ))}
      </div>
    </div>
  );
}

function DeviceCard({ id, device }) {
  const { name, history, lastSeen, status } = device;
  const metrics = ["ph", "temp", "cod", "ss"];

  // Chart labels: use payload timestamps
  const labels = history.map(h => h.time.toLocaleString());
  const datasets = metrics.map((key, i) => ({
    label: key.toUpperCase(),
    data: history.map(h => h.data[key] ?? null),
    fill: false,
    tension: 0.3,
    borderColor: ["#0f6", "#6cf", "#fc0", "#f6a"][i],
  }));

  // Latest entry for display
  const latest = history[history.length - 1] || {};

  return (
    <div style={{
      ...styles.card,
      border: status === "online" ? "2px solid #0f6" : "2px solid #f66",
    }}>
      <div style={styles.cardHeader}>
        <div style={styles.icon}>
          {ICON_MAP[id.split(/[:.]/)[0]] || <FaQuestionCircle />}
        </div>
        <div>
          <h3 style={styles.deviceName}>{name}</h3>
          <div style={styles.deviceId}>{id}</div>
        </div>
      </div>

      {/* Chart of PH, Temp, COD, SS */}
      <div style={styles.chart}>
        <Line
          data={{ labels, datasets }}
          options={{
            responsive: true,
            plugins: { legend: { position: "bottom" } },
            scales: {
              x: { ticks: { maxTicksLimit: 5 } },
              y: { beginAtZero: true },
            },
          }}
        />
      </div>

      {/* Latest values with payload timestamp */}
      <div style={styles.values}>
        <div style={styles.timestamp}>
          Data Time: {latest.time ? latest.time.toLocaleString() : "--"}
        </div>
        {metrics.map(key => (
          <div key={key} style={styles.valueRow}>
            <div style={styles.valueIcon}>{ICON_MAP[key]}</div>
            <div style={styles.valueLabel}>{key.toUpperCase()}</div>
            <div style={styles.valueData}>
              {latest.data?.[key] ?? "--"}
              {key === "temp" ? "°C" : ""}
            </div>
          </div>
        ))}
      </div>

      <div style={styles.footer}>
        <span style={{ opacity: 0.7, fontSize: 12 }}>
          Last Seen: {lastSeen.toLocaleTimeString()}
        </span>
        <span style={{
          marginLeft: 8,
          color: status === "online" ? "#0f6" : "#f66",
          fontWeight: 600,
        }}>
          {status === "online" ? <FaCheckCircle /> : <FaTimesCircle />}
        </span>
      </div>
    </div>
  );
}

const styles = {
  app: { background: "#181f2a", color: "#fff", minHeight: "100vh", padding: 16, fontFamily: "Poppins, sans-serif" },
  header: { textAlign: "center", marginBottom: 24 },

  summary: { display: "flex", justifyContent: "center", gap: 24, marginBottom: 32 },
  summaryItem: { background: "#232f47", borderRadius: 8, padding: "12px 20px", textAlign: "center", minWidth: 100, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" },
  summaryNumber: { display: "block", fontSize: 28, fontWeight: 700 },
  summaryNumberOnline: { display: "block", fontSize: 28, fontWeight: 700, color: "#0f6" },
  summaryNumberOffline: { display: "block", fontSize: 28, fontWeight: 700, color: "#f66" },

  grid: { display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "flex-start" },
  waiting: { opacity: 0.6, fontSize: 18, marginTop: 80, textAlign: "center", width: "100%" },

  card: { background: "#232f47", borderRadius: 12, width: 300, margin: 0, padding: 16, boxShadow: "0 4px 12px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column" },
  cardHeader: { display: "flex", alignItems: "center", marginBottom: 12 },
  icon: { fontSize: 28, marginRight: 8 },
  deviceName: { fontSize: 18, margin: 0 },
  deviceId: { fontSize: 12, opacity: 0.6 },

  chart: { width: "100%", height: 150, marginBottom: 16 },

  values: { marginBottom: 12 },
  timestamp: { marginBottom: 8, fontSize: 12, opacity: 0.7 },
  valueRow: { display: "flex", alignItems: "center", margin: "6px 0" },
  valueIcon: { width: 24, textAlign: "center" },
  valueLabel: { flex: 1, fontSize: 14 },
  valueData: { fontWeight: 600, fontSize: 14 },

  footer: { display: "flex", alignItems: "center", marginTop: "auto" },
};
