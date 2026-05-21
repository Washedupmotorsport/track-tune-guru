export function WavingFlags({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="checkers" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#f5f5f5" />
          <rect width="4" height="4" fill="#1a1a1a" />
          <rect x="4" y="4" width="4" height="4" fill="#1a1a1a" />
        </pattern>
      </defs>

      {/* Left flagpole */}
      <rect x="10" y="8" width="2" height="48" rx="1" fill="#b0b0b0" />
      {/* Right flagpole */}
      <rect x="52" y="8" width="2" height="48" rx="1" fill="#b0b0b0" />

      {/* Left flag */}
      <path
        d="M12 8 C22 6, 28 10, 36 8 L36 28 C28 30, 22 26, 12 28 Z"
        fill="url(#checkers)"
        stroke="#1a1a1a"
        strokeWidth="0.5"
        className="animate-flag-wave-left origin-left"
        style={{ transformOrigin: "12px 18px" }}
      />

      {/* Right flag */}
      <path
        d="M54 8 C44 6, 38 10, 30 8 L30 28 C38 30, 44 26, 54 28 Z"
        fill="url(#checkers)"
        stroke="#1a1a1a"
        strokeWidth="0.5"
        className="animate-flag-wave-right origin-right"
        style={{ transformOrigin: "54px 18px" }}
      />

      <style>{`
        @keyframes flagWaveLeft {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(8deg); }
          75% { transform: rotate(-4deg); }
        }
        @keyframes flagWaveRight {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-8deg); }
          75% { transform: rotate(4deg); }
        }
        .animate-flag-wave-left {
          animation: flagWaveLeft 1.2s ease-in-out infinite;
        }
        .animate-flag-wave-right {
          animation: flagWaveRight 1.2s ease-in-out infinite;
        }
      `}</style>
    </svg>
  );
}
