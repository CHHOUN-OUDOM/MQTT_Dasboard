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

// Read socket URL from environment
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

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });

    socket.on("mqtt_message", ({ message }) => {
      let payload;
      try { payload = JSON.parse(message).payload; } catch { return; }
      const { id, name, fields } = payload;
      const latest = Array.isArray(fields) && fields.length ? fields[fields.length - 1] : {};

      setDevices(old => {
        const prev = old[id]?.history || [];
        const entry = { time: new Date(latest.timestamp * 1000), data: latest };
        const history = [...prev, entry].slice(-20);
        return {
          ...old,
          [id]: { name, history, lastSeen: new Date(), status: "online" }
        };
      });
    });

    return () => socket.disconnect();
  }, []);

  // Offline detection
  useEffect(() => {
    const timer = setInterval(() => {
      setDevices(old => {
        const now = Date.now();
        const updated = {};
        Object.entries(old).forEach(([id, dev]) => {
          updated[id] = { ...dev, status: now - dev.lastSeen.getTime() > 30000 ? "offline" : "online" };
        });
        return updated;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Summary
  const ids = Object.keys(devices);
  const total = ids.length;
  const online = ids.filter(id => devices[id].status === "online").length;
  const offline = total - online;

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1>MQTT Devices Dashboard</h1>
      </header>

      <section style={styles.summary}>
        <div style={styles.summaryCard}>
          <strong>{total}</strong>
          <span>Total</span>
        </div>
        <div style={styles.summaryCard}>
          <strong style={{ color: "#4caf50" }}>{online}</strong>
          <span>Online</span>
        </div>
        <div style={styles.summaryCard}>
          <strong style={{ color: "#f44336" }}>{offline}</strong>
          <span>Offline</span>
        </div>
      </section>

      <main style={styles.grid}>
        {ids.length === 0 && <p style={styles.waiting}>Waiting for devices…</p>}
        {ids.map(id => (
          <DeviceCard key={id} id={id} device={devices[id]} />
        ))}
      </main>
    </div>
  );
}

function DeviceCard({ id, device }) {
  const { name, history, lastSeen, status } = device;
  const metrics = ["ph", "temp", "cod", "ss"];
  const labels = history.map(h => h.time.toLocaleTimeString());
  const datasets = metrics.map((key, i) => ({
    label: key.toUpperCase(),
    data: history.map(h => h.data[key] ?? null),
    fill: false,
    tension: 0.3,
    borderColor: ["#2196f3", "#ff9800", "#9c27b0", "#00bcd4"][i],
  }));
  const latest = history[history.length - 1]?.data || {};

  return (
    <div style={{ ...styles.card, borderColor: status === "online" ? "#4caf50" : "#f44336" }}>
      <div style={styles.cardHeader}>
        <div style={styles.icon}>{ICON_MAP[id.split(":")[0]] || <FaQuestionCircle />}</div>
        <div>
          <h2 style={styles.deviceName}>{name}</h2>
          <p style={styles.deviceId}>{id}</p>
        </div>
      </div>

      <div style={styles.chart}>
        <Line
          data={{ labels, datasets }}
          options={{
            maintainAspectRatio: false,
            plugins: { legend: { position: "bottom" } },
            scales: { x: { ticks: { maxTicksLimit: 4 } }, y: { beginAtZero: true } }
          }}
        />
      </div>

      <div style={styles.values}>
        {metrics.map(key => (
          <div key={key} style={styles.valueRow}>
            <div style={styles.valueIcon}>{ICON_MAP[key]}</div>
            <div style={styles.valueLabel}>{key.toUpperCase()}</div>
            <div style={styles.valueData}>{latest[key] ?? "--"}{key === "temp" && "°C"}</div>
          </div>
        ))}
      </div>

      <div style={styles.footer}>
        <span>Last Seen: {lastSeen.toLocaleTimeString()}</span>
        <span style={{ marginLeft: 8 }}>{status === "online" ? <FaCheckCircle color="#4caf50" /> : <FaTimesCircle color="#f44336" />}</span>
      </div>
    </div>
  );
}

const styles = {
  app: { fontFamily: "Roboto, sans-serif", background: "#f5f5f5", color: "#333", minHeight: "100vh", padding: "16px" },
  header: { textAlign: "center", marginBottom: "24px" },
  summary: { display: "flex", justifyContent: "center", gap: "16px", marginBottom: "32px" },
  summaryCard: { background: "#fff", padding: "16px 24px", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", textAlign: "center" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "24px" },
  waiting: { textAlign: "center", marginTop: "80px", color: "#777" },

  card: { background: "#fff", border: "2px solid", borderRadius: "8px", boxShadow: "0 2px 12px rgba(0,0,0,0.1)", display: "flex", flexDirection: "column", padding: "16px" },
  cardHeader: { display: "flex", alignItems: "center", marginBottom: "16px" },
  icon: { fontSize: "32px", marginRight: "12px" },
  deviceName: { margin: 0, fontSize: "18px" },
  deviceId: { margin: 0, fontSize: "12px", color: "#777" },

  chart: { flex: 1, minHeight: "180px", marginBottom: "16px" },

  values: { marginBottom: "16px" },
  valueRow: { display: "flex", alignItems: "center", marginBottom: "8px" },
  valueIcon: { width: "24px", textAlign: "center" },
  valueLabel: { flex: 1, fontSize: "14px" },
  valueData: { fontWeight: "600", fontSize: "14px" },

  footer: { display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#555" },
};
