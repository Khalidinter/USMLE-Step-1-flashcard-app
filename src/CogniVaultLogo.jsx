// SVG recreation of CogniVault Labs logo
export default function CogniVaultLogo({ size = 200 }) {
  const s = size / 200;
  return (
    <svg width={200 * s} height={200 * s} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer hexagon */}
      <polygon points="100,10 178,55 178,145 100,190 22,145 22,55" stroke="#2A9D8F" strokeWidth="2" fill="none" opacity="0.8"/>
      {/* Inner hexagon */}
      <polygon points="100,30 160,65 160,135 100,170 40,135 40,65" stroke="#2A9D8F" strokeWidth="1.5" fill="rgba(42,157,143,0.05)" opacity="0.6"/>
      {/* Circuit traces */}
      <circle cx="60" cy="60" r="3" fill="#2A9D8F" opacity="0.7"/>
      <circle cx="140" cy="60" r="3" fill="#2A9D8F" opacity="0.7"/>
      <circle cx="45" cy="100" r="2.5" fill="#2A9D8F" opacity="0.5"/>
      <circle cx="155" cy="100" r="2.5" fill="#2A9D8F" opacity="0.5"/>
      <circle cx="60" cy="140" r="3" fill="#2A9D8F" opacity="0.7"/>
      <circle cx="140" cy="140" r="3" fill="#2A9D8F" opacity="0.7"/>
      {/* Trace lines */}
      <line x1="60" y1="60" x2="80" y2="75" stroke="#2A9D8F" strokeWidth="1" opacity="0.4"/>
      <line x1="140" y1="60" x2="120" y2="75" stroke="#2A9D8F" strokeWidth="1" opacity="0.4"/>
      <line x1="45" y1="100" x2="70" y2="100" stroke="#2A9D8F" strokeWidth="1" opacity="0.4"/>
      <line x1="155" y1="100" x2="130" y2="100" stroke="#2A9D8F" strokeWidth="1" opacity="0.4"/>
      <line x1="60" y1="140" x2="80" y2="125" stroke="#2A9D8F" strokeWidth="1" opacity="0.4"/>
      <line x1="140" y1="140" x2="120" y2="125" stroke="#2A9D8F" strokeWidth="1" opacity="0.4"/>
      {/* Keyhole body */}
      <circle cx="100" cy="90" r="18" fill="#7FFF00" opacity="0.9"/>
      <rect x="93" y="95" width="14" height="28" rx="3" fill="#7FFF00" opacity="0.9"/>
      {/* Keyhole cutout */}
      <circle cx="100" cy="88" r="7" fill="#0A0E17"/>
      <rect x="96" y="90" width="8" height="16" rx="2" fill="#0A0E17"/>
      {/* Glow effect */}
      <circle cx="100" cy="95" r="35" fill="#7FFF00" opacity="0.04"/>
      <circle cx="100" cy="95" r="50" fill="#7FFF00" opacity="0.02"/>
    </svg>
  );
}

export function CogniVaultIcon({ size = 24 }) {
  const s = size / 24;
  return (
    <svg width={24*s} height={24*s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="12,1 22,6.5 22,17.5 12,23 2,17.5 2,6.5" stroke="#2A9D8F" strokeWidth="1.2" fill="rgba(42,157,143,0.08)"/>
      <circle cx="12" cy="10.5" r="3" fill="#7FFF00" opacity="0.9"/>
      <rect x="10.5" y="11.5" width="3" height="5" rx="1" fill="#7FFF00" opacity="0.9"/>
      <circle cx="12" cy="10" r="1.2" fill="#0A0E17"/>
      <rect x="11.2" y="10.5" width="1.6" height="3" rx="0.5" fill="#0A0E17"/>
    </svg>
  );
}
