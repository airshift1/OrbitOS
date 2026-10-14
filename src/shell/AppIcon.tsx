import { getIcon } from "../lib/icons";

interface AppIconProps {
  icon: string;
  size?: number;
  className?: string;
}

/** Monochrome icon tile used by the taskbar, Start menu, launcher and desktop. */
export function AppIcon({ icon, size = 36, className }: AppIconProps) {
  const Icon = getIcon(icon);
  return (
    <span className={`app-icon ${className ?? ""}`} aria-hidden="true" style={{ width: size, height: size }}>
      {icon === "OrbitMeteor" ? (
        <svg width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} viewBox="0 0 48 48" fill="none">
          <path d="M8 8 23 23M14 5l16 16M5 14l15 15" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <circle cx="31" cy="31" r="10" fill="currentColor" />
        </svg>
      ) : (
        <Icon size={Math.round(size * 0.5)} strokeWidth={1.6} />
      )}
    </span>
  );
}
