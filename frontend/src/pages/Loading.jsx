// src/pages/Loading.jsx
import React, { useEffect, useState } from "react";
import BrandMark from "../components/BrandMark";

const LoadingScreen = () => {
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState("Initializing...");

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + (100 - prev) * 0.1;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const textInterval = setInterval(() => {
      const texts = [
        "Initializing secure voting platform...",
        "Loading encryption modules...",
        "Setting up authentication...",
        "Preparing your dashboard...",
        "Almost ready...",
      ];
      setLoadingText(texts[Math.floor(progress / 20)] || "Almost ready...");
    }, 1200);

    return () => clearInterval(textInterval);
  }, [progress]);

  return (
    <div className="loading-screen">
      <div className="loading-background" />

      <div className="loading-content">
        <div className="brand-section">
          <div className="brand-logo">
            <BrandMark size="xl" className="shadow-brand loading-mark" />
          </div>
          <h1 className="brand-name">AmarVote</h1>
          <p className="brand-tagline">Secure digital voting</p>
        </div>

        <div className="progress-section">
          <div className="progress-container">
            <div className="progress-circle">
              <svg className="progress-ring" viewBox="0 0 120 120">
                <circle className="progress-ring-circle-bg" cx="60" cy="60" r="50" />
                <circle
                  className="progress-ring-circle"
                  cx="60"
                  cy="60"
                  r="50"
                  style={{
                    strokeDasharray: `${2 * Math.PI * 50}`,
                    strokeDashoffset: `${2 * Math.PI * 50 * (1 - progress / 100)}`,
                  }}
                />
              </svg>
              <div className="progress-text">
                <span className="progress-percentage">{Math.round(progress)}%</span>
              </div>
            </div>
          </div>

          <div className="loading-message">
            <span className="loading-text">{loadingText}</span>
            <div className="loading-dots">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </div>
        </div>

        <div className="features-preview">
          {[
            "End-to-end encryption",
            "Cryptographic verification",
            "Zero-knowledge proofs",
            "Transparent audit",
          ].map((label) => (
            <div key={label} className="feature-item">
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <style>
        {`
        .loading-screen {
          position: fixed;
          inset: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 9999;
          overflow: hidden;
        }

        .loading-background {
          position: absolute;
          inset: 0;
          background: linear-gradient(-45deg, #12142B, #1A1C38, #12142B, #5C52C4);
          background-size: 400% 400%;
          animation: gradient 12s ease infinite;
        }

        .loading-background::before {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(18, 20, 43, 0.12);
        }

        .loading-content {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2.5rem;
          background: rgba(247, 244, 236, 0.96);
          border-radius: 28px;
          box-shadow: 0 30px 60px rgba(18, 20, 43, 0.22);
          border: 1px solid rgba(139, 127, 232, 0.2);
          max-width: 420px;
          width: 90%;
          animation: fadeInUp 0.8s ease-out;
        }

        .brand-section {
          text-align: center;
          margin-bottom: 2rem;
        }

        .brand-logo {
          margin-bottom: 1rem;
          display: flex;
          justify-content: center;
        }

        .loading-mark {
          animation: bounce 2s infinite;
        }

        .brand-name {
          font-family: "Fraunces", Georgia, serif;
          font-size: 2rem;
          font-weight: 700;
          color: #1B1D2E;
          margin: 0.5rem 0;
        }

        .brand-tagline {
          color: #5B5D74;
          font-size: 0.875rem;
          margin: 0;
        }

        .progress-section {
          text-align: center;
          margin-bottom: 2rem;
        }

        .progress-container {
          margin-bottom: 1rem;
        }

        .progress-circle {
          position: relative;
          width: 120px;
          height: 120px;
          margin: 0 auto;
        }

        .progress-ring {
          width: 100%;
          height: 100%;
          transform: rotate(-90deg);
        }

        .progress-ring-circle-bg {
          fill: none;
          stroke: #E8E5FA;
          stroke-width: 4;
        }

        .progress-ring-circle {
          fill: none;
          stroke: url(#av-loading-gradient);
          stroke-width: 4;
          stroke-linecap: round;
          transition: stroke-dashoffset 0.3s ease;
        }

        .progress-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }

        .progress-percentage {
          font-family: "Fraunces", Georgia, serif;
          font-size: 1.5rem;
          font-weight: 700;
          color: #1B1D2E;
        }

        .loading-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .loading-text {
          color: #5B5D74;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .loading-dots {
          display: flex;
          gap: 0.25rem;
        }

        .dot {
          width: 4px;
          height: 4px;
          background: #8B7FE8;
          border-radius: 50%;
          animation: blink 1.4s infinite;
        }

        .dot:nth-child(1) { animation-delay: 0.2s; }
        .dot:nth-child(2) { animation-delay: 0.4s; }
        .dot:nth-child(3) { animation-delay: 0.6s; }

        .features-preview {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: center;
          margin-top: 0.5rem;
        }

        .feature-item {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.65rem 0.85rem;
          background: rgba(139, 127, 232, 0.1);
          border-radius: 14px;
          border: 1px solid rgba(139, 127, 232, 0.22);
          min-width: 0;
          transition: transform 0.3s ease, background 0.3s ease;
        }

        .feature-item:hover {
          transform: translateY(-2px);
          background: rgba(139, 127, 232, 0.16);
        }

        .feature-item span {
          font-size: 0.75rem;
          color: #5C52C4;
          text-align: center;
          font-weight: 600;
          line-height: 1.25;
        }

        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        @keyframes blink {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }

        @media (max-width: 480px) {
          .loading-content { padding: 1.5rem; margin: 1rem; }
          .brand-name { font-size: 1.75rem; }
        }

        @media (prefers-reduced-motion: reduce) {
          .loading-background, .loading-mark, .dot { animation: none !important; }
        }
        `}
      </style>

      <svg width="0" height="0" aria-hidden="true">
        <defs>
          <linearGradient id="av-loading-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8B7FE8" />
            <stop offset="100%" stopColor="#5C52C4" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

export default LoadingScreen;
