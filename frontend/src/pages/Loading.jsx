// src/components/LoadingScreen.jsx
import { useEffect, useState } from "react";

const LoadingScreen = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + (100 - prev) * 0.1; // Easing function
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Inline styles
  const styles = {
    loadingScreen: {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      background: "#f8f9fa",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 9999,
    },
    spinnerContainer: {
      position: "relative",
      width: "120px",
      height: "120px",
    },
    spinner: {
      width: "100%",
      height: "100%",
      borderRadius: "50%",
      background: `conic-gradient(#4f46e5 ${progress}%, #e0e7ff ${progress}%)`,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      animation: "pulse 2s infinite ease-in-out",
    },
    spinnerInner: {
      width: "80%",
      height: "80%",
      background: "#f8f9fa",
      borderRadius: "50%",
    },
    progressText: {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      fontSize: "1.5rem",
      fontWeight: "bold",
      color: "#4f46e5",
    },
    loadingMessage: {
      marginTop: "2rem",
      fontSize: "1.2rem",
      color: "#4b5563",
    },
    loadingDots: {
      display: "inline-block",
    },
    dot: {
      opacity: 0,
      animation: "blink 1.4s infinite",
    },
    dot1: { animationDelay: "0.2s" },
    dot2: { animationDelay: "0.4s" },
    dot3: { animationDelay: "0.6s" },
    // Keyframes as JS objects
    "@keyframes pulse": {
      "0%, 100%": { transform: "scale(1)" },
      "50%": { transform: "scale(1.05)" },
    },
    "@keyframes blink": {
      "0%, 100%": { opacity: 0 },
      "50%": { opacity: 1 },
    },
  };

  return (
    <div style={styles.loadingScreen}>
      <div style={styles.spinnerContainer}>
        <div style={styles.spinner}>
          <div style={styles.spinnerInner}></div>
        </div>
        <div style={styles.progressText}>{Math.round(progress)}%</div>
      </div>
      <div style={styles.loadingMessage}>
        Loading
        <span style={styles.loadingDots}>
          <span style={{ ...styles.dot, ...styles.dot1 }}>.</span>
          <span style={{ ...styles.dot, ...styles.dot2 }}>.</span>
          <span style={{ ...styles.dot, ...styles.dot3 }}>.</span>
        </span>
      </div>

      {/* Inject CSS keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes blink {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;
