// Vulcan Avatar — Roman god of the forge
// Stylized anvil + hammer with flame accent
export default function VulcanAvatar({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background circle */}
      <circle cx="32" cy="32" r="32" fill="#1e3a5f" />

      {/* Inner glow ring */}
      <circle cx="32" cy="32" r="28" fill="none" stroke="#f59e0b" strokeWidth="1" opacity="0.4" />

      {/* Flame accent behind helmet */}
      <path
        d="M32 8 C34 14, 38 12, 36 18 C38 14, 40 16, 38 20 C40 16, 42 18, 39 22 C36 26, 28 26, 25 22 C22 18, 24 16, 26 20 C24 16, 26 14, 28 18 C26 12, 30 14, 32 8Z"
        fill="url(#flameGrad)"
        opacity="0.85"
      />

      {/* Helmet base — Vulcan's forge helm */}
      <path
        d="M20 30 C20 22, 24 18, 32 18 C40 18, 44 22, 44 30 L44 34 C44 35, 43 36, 42 36 L22 36 C21 36, 20 35, 20 34 Z"
        fill="#c0c0c0"
      />

      {/* Helmet visor slit */}
      <rect x="23" y="28" width="18" height="3" rx="1" fill="#1e3a5f" />

      {/* Helmet crest/ridge */}
      <path
        d="M30 18 C30 15, 32 14, 32 14 C32 14, 34 15, 34 18"
        stroke="#f59e0b"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M28 20 L32 13 L36 20"
        fill="#f59e0b"
        opacity="0.9"
      />

      {/* Helmet cheek guards */}
      <path
        d="M20 30 L18 34 C18 36, 19 37, 21 36 L22 34"
        fill="#a0a0a0"
      />
      <path
        d="M44 30 L46 34 C46 36, 45 37, 43 36 L42 34"
        fill="#a0a0a0"
      />

      {/* Visor glow — eyes */}
      <circle cx="28" cy="29.5" r="1.5" fill="#f59e0b" opacity="0.9" />
      <circle cx="36" cy="29.5" r="1.5" fill="#f59e0b" opacity="0.9" />

      {/* Anvil below */}
      <path
        d="M22 40 L18 44 L18 47 C18 48, 19 49, 20 49 L44 49 C45 49, 46 48, 46 47 L46 44 L42 40 Z"
        fill="#6b7280"
      />
      {/* Anvil top surface */}
      <rect x="22" y="38" width="20" height="3" rx="1" fill="#9ca3af" />

      {/* Anvil horn (left) */}
      <path
        d="M22 39 L16 41 C15 41.5, 15 42.5, 16 43 L22 41"
        fill="#9ca3af"
      />

      {/* Small hammer */}
      <g transform="rotate(-30, 42, 32)">
        {/* Handle */}
        <rect x="40" y="30" width="2" height="14" rx="1" fill="#8B4513" />
        {/* Head */}
        <rect x="37" y="27" width="8" height="4" rx="1" fill="#4b5563" />
      </g>

      {/* Spark particles */}
      <circle cx="15" cy="35" r="1" fill="#fbbf24" opacity="0.8" />
      <circle cx="49" cy="25" r="0.8" fill="#fbbf24" opacity="0.6" />
      <circle cx="13" cy="28" r="0.6" fill="#f97316" opacity="0.7" />
      <circle cx="51" cy="32" r="0.7" fill="#fbbf24" opacity="0.5" />

      {/* Gradient definitions */}
      <defs>
        <radialGradient id="flameGrad" cx="50%" cy="80%" r="60%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#dc2626" />
        </radialGradient>
      </defs>
    </svg>
  );
}
