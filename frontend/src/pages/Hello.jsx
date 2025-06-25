import React, { useEffect, useState } from "react";

function Hello() {
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    fetch("/api/health", {
      credentials: "include", // if you expect cookies to be sent
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch /api/health");
        return res.text(); // or res.json() if backend returns JSON
      })
      .then((data) => setMessage(data))
      .catch((err) => setMessage("Error: " + err.message));
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Backend says:</h1>
      <p>{message}</p>
    </div>
  );
}

export default Hello;
