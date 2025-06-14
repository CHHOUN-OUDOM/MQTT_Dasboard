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

// Define sensors with icons and units
const METRICS = [
  { key: "ph",   icon: <FaTint />,            unit: "pH"   },
  { key: "temp", icon: <FaThermometerHalf />, unit: "°C"   },
  { key: "cod",  icon: <FaFlask />,           unit: "mg/L" },
  { key: "ss",   icon: <FaCloud />,           unit: "g/L"  },
];

export default function App() {
  const [devices, setDevices] = useState({});
  const [darkMode, setDarkMode] = useState(true);

  // Subscribe to MQTT messages via Socket.IO proxy
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socket.on("mqtt_message", ({ message }) => {
      let payload;
      try { payload = JSON.parse(message).payload; }
      catch { return; }
      const { id, name, fields } = payload;
      const latest = Array.isArray(fields) && fields.length ? fields[fields.length - 1] : {};

      setDevices(prev => {
        const prevHistory = prev[id]?.history || [];
        const entry = { time: new Date(latest.timestamp * 1000), data: latest };
        const history = [...prevHistory, entry].slice(-20);
        return { ...prev, [id]: { name, history, lastSeen: new Date(), status: "online" } };
      });
    });
    return () => socket.disconnect();
  }, []);

  // Offline detection
  useEffect(() => {
    const timer = setInterval(() => {
      setDevices(prev => {
        const now = Date.now(), updated = {};
        Object.entries(prev).forEach(([id, dev]) => {
          updated[id] = { ...dev, status: now - dev.lastSeen.getTime() > 30000 ? "offline" : "online" };
        });
        return updated;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const ids = Object.keys(devices);
  // Group and sort by OUI (first three octets) then full MAC
  const sortedIds = [...ids].sort((a, b) => {
    const ga = a.split(":").slice(0, 3).join(":"),
          gb = b.split(":").slice(0, 3).join(":");
    if (ga < gb) return -1;
    if (ga > gb) return 1;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  const total   = ids.length;
  const online  = ids.filter(id => devices[id].status === "online").length;
  const offline = total - online;

  return (
    <div style={darkMode ? styles.appDark : styles.appLight}>
      <header style={styles.header}>
        <h1 style={darkMode ? styles.titleDark : styles.titleLight}>MQTT Devices Dashboard</h1>
        <button
          style={{
            ...styles.themeButton,
            background: darkMode ? "#333" : "#ddd",
            color: darkMode ? "#fff" : "#333",
            borderColor: darkMode ? "#fff" : "#333"
          }}
          onClick={() => setDarkMode(!darkMode)}
        >
          {darkMode ? "Light Mode" : "Dark Mode"}
        </button>
      </header>

      <section style={styles.summary}>
        <div style={styles.summaryCard}><strong>{total}</strong><span>Total</span></div>
        <div style={styles.summaryCard}><strong style={{color: "#4caf50"}}>{online}</strong><span>Online</span></div>
        <div style={styles.summaryCard}><strong style={{color: "#f44336"}}>{offline}</strong><span>Offline</span></div>
      </section>

      <main style={styles.grid}>
        {sortedIds.length === 0
          ? <p style={styles.waiting}>Waiting for devices…</p>
          : sortedIds.map(id => <DeviceCard key={id} id={id} device={devices[id]} />)
        }
      </main>

      <footer style={styles.footerText}>
        &copy; {new Date().getFullYear()} ROCKSTAR Modern Control. All rights reserved.
      </footer>
    </div>
  );
}

function DeviceCard({ id, device }) {
  const { name, history, lastSeen, status } = device;
  const labels   = history.map(h => h.time.toLocaleTimeString());
  const datasets = METRICS.map((m, i) => ({
    label: m.key.toUpperCase(),
    data: history.map(h => h.data[m.key] ?? null),
    fill: false,
    tension: 0.3,
    borderColor: ["#2196f3","#ff9800","#9c27b0","#00bcd4"][i],
  }));
  const latest = history[history.length - 1]?.data || {};

  return (
    <div style={{ ...styles.card, borderColor: status === "online" ? "#4caf50" : "#f44336" }}>
      <div style={styles.cardHeader}>
        <div style={styles.icon}>{METRICS.find(m => m.key === id.split(":")[0])?.icon || <FaQuestionCircle/>}</div>
        <div>
          <h2 style={styles.deviceName}>{name}</h2>
          <p style={styles.deviceId}>{id}</p>
        </div>
      </div>

      <div style={styles.chart}>
        <Line
          data={{ labels, datasets }}
          options={{ maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, scales: { x: { display: false }, y: { beginAtZero: true } } }}
        />
      </div>

      <div style={styles.values}>
        {METRICS.map(m => (
          <div key={m.key} style={styles.valueRow}>
            <div style={styles.valueIcon}>{m.icon}</div>
            <div style={styles.valueLabel}>{m.key.toUpperCase()}</div>
            <div style={styles.valueData}>{latest[m.key] != null ? `${latest[m.key]} ${m.unit}` : "--"}</div>
          </div>
        ))}
      </div>

      <div style={styles.footer}>
        <span>Last Seen: {lastSeen.toLocaleTimeString()}</span>
        <span style={{ marginLeft: 8 }}>{status === "online" ? <FaCheckCircle color="#4caf50"/> : <FaTimesCircle color="#f44336"/>}</span>
      </div>
    </div>
  );
}

const styles = {
  appDark: { fontFamily:"Roboto, sans-serif", background:"#181f2a", color:"#fff", minHeight:"100vh", padding:"16px" },
  appLight:{ fontFamily:"Roboto, sans-serif", background:"#f5f5f5", color:"#333", minHeight:"100vh", padding:"16px" },
  header:{ position:"relative", padding:"0 24px", height:"60px", display:"flex", alignItems:"center" },
  titleDark:{ color:"#fff", margin:"0 auto", fontSize:"24px" },
  titleLight:{ color:"#333", margin:"0 auto", fontSize:"24px" },
  themeButton:{ position:"absolute", right:"24px", padding:"8px 12px", border:"1px solid", borderRadius:"4px", cursor:"pointer" },
  summary:{ display:"flex", justifyContent:"center", gap:"16px", marginBottom:"32px" },
  summaryCard:{ background:"#fff", padding:"16px 24px", borderRadius:"8px", boxShadow:"0 2px 8px rgba(0,0,0,0.1)", textAlign:"center" },
  grid:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:"24px" },
  waiting:{ textAlign:"center", marginTop:"80px", color:"#777" },
  card:{ background:"#fff", border:"2px solid", borderRadius:"8px", boxShadow:"0 2px 12px rgba(0,0,0,0.1)", display:"flex", flexDirection:"column", padding:"16px" },
  cardHeader:{ display:"flex", alignItems:"center", marginBottom:"16px" },
  icon:{ fontSize:"32px", marginRight:"12px" },
  deviceName:{ margin:0, fontSize:"18px" },
  deviceId:{ margin:0, fontSize:"12px", color:"#777" },
  chart:{ flex:1, minHeight:"150px", marginBottom:"16px" },
  values:{ marginBottom:"16px" },
  valueRow:{ display:"flex", alignItems:"center", marginBottom:"8px" },
  valueIcon:{ width:"24px", textAlign:"center" },
  valueLabel:{ flex:1, fontSize:"14px" },
  valueData:{ fontWeight:"600", fontSize:"14px" },
  footer:{ display:"flex", justifyContent:"space-between", fontSize:"12px", color:"#555", marginTop:"auto" },
  footerText:{ textAlign:"center", marginTop:"40px", fontSize:"12px", color:"#999" }
};
