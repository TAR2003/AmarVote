// src/pages/Loading.jsx
import React, { useEffect, useState } from "react";

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
        return prev + (100 - prev) * 0.1; // Easing function
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
      {/* Background with animated gradient */}
      <div className="loading-background"></div>
      
      {/* Main loading content */}
      <div className="loading-content">
        {/* Logo/Brand section */}
        <div className="brand-section">
          <div className="brand-logo">
            <div className="vote-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 12 2 2 4-4" />
                <path d="M21 12c.552 0 1-.448 1-1V8c0-.552-.448-1-1-1s-1 .448-1 1v3c0 .552.448 1 1 1z" />
                <path d="M3 12c-.552 0-1-.448-1-1V8c0-.552.448-1 1-1s1 .448 1 1v3c0 .552-.448 1-1 1z" />
                <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" />
              </svg>
            </div>
          </div>
          <h1 className="brand-name">AmarVote</h1>
          <p className="brand-tagline">Secure Digital Voting Platform</p>
        </div>

        {/* Progress section */}
        <div className="progress-section">
          <div className="progress-container">
            <div className="progress-circle">
              <svg className="progress-ring" viewBox="0 0 120 120">
                <circle
                  className="progress-ring-circle-bg"
                  cx="60"
                  cy="60"
                  r="50"
                />
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
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
          </div>
        </div>

        {/* Features preview */}
        <div className="features-preview">
          <div className="feature-item">
            <div className="feature-icon">🔒</div>
            <span>End-to-End Encryption</span>
          </div>
          <div className="feature-item">
            <div className="feature-icon">✅</div>
            <span>Cryptographic Verification</span>
          </div>
          <div className="feature-item">
            <div className="feature-icon">🛡️</div>
            <span>Zero-Knowledge Proofs</span>
          </div>
          <div className="feature-item">
            <div className="feature-icon">🚀</div>
            <span>Real-time Results</span>
          </div>
          <div className="feature-item">
            <div className="feature-icon">📊</div>
            <span>Transparent Audit</span>
          </div>
        </div>
      </div>

      <style>
        {`
        .loading-screen {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 9999;
          overflow: hidden;
        }

        .loading-background {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(-45deg, #2563eb, #1d4ed8, #3b82f6, #2563eb);
          background-size: 400% 400%;
          animation: gradient 12s ease infinite;
        }

        .loading-background::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.1);
          backdrop-filter: blur(1px);
        }

        .loading-content {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2.5rem;
          background: rgba(255, 255, 255, 0.98);
          border-radius: 28px;
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.12);
          backdrop-filter: blur(15px);
          border: 1px solid rgba(255, 255, 255, 0.3);
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
        }

        .vote-icon {
          width: 60px;
          height: 60px;
          margin: 0 auto;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          animation: bounce 2s infinite;
        }

        .vote-icon svg {
          width: 32px;
          height: 32px;
        }

        .brand-name {
          font-size: 2rem;
          font-weight: 700;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0.5rem 0;
        }

        .brand-tagline {
          color: #6b7280;
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
          stroke: #e5e7eb;
          stroke-width: 4;
        }

        .progress-ring-circle {
          fill: none;
          stroke: url(#gradient);
          stroke-width: 4;
          stroke-linecap: round;
          transition: stroke-dashoffset 0.3s ease;
        }

        .progress-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .progress-percentage {
          font-size: 1.5rem;
          font-weight: 700;
          color: #374151;
        }

        .loading-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .loading-text {
          color: #6b7280;
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
          background: #9ca3af;
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
          margin-top: 1rem;
        }

        .feature-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem 0.75rem;
          background: rgba(37, 99, 235, 0.08);
          border-radius: 16px;
          border: 1px solid rgba(37, 99, 235, 0.15);
          min-width: 90px;
          transition: all 0.3s ease;
          animation: fadeIn 1s ease-out;
        }

        .feature-item:hover {
          transform: translateY(-2px);
          background: rgba(37, 99, 235, 0.12);
          box-shadow: 0 8px 25px rgba(37, 99, 235, 0.15);
        }

        .feature-icon {
          font-size: 1.5rem;
          margin-bottom: 0.25rem;
        }

        .feature-item span {
          font-size: 0.75rem;
          color: #4b5563;
          text-align: center;
          font-weight: 600;
          line-height: 1.2;
        }

        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        @keyframes blink {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }

        @media (max-width: 480px) {
          .loading-content {
            padding: 1.5rem;
            margin: 1rem;
          }

          .brand-name {
            font-size: 1.75rem;
          }

          .features-preview {
            gap: 0.5rem;
          }

          .feature-item {
            min-width: 80px;
            padding: 0.5rem;
          }
        }
        `}
      </style>

      {/* SVG Gradient Definition */}
      <svg width="0" height="0">
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

export default LoadingScreen;
