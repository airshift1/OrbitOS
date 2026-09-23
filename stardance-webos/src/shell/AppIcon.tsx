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
      <Icon size={Math.round(size * 0.5)} strokeWidth={1.6} />
    </span>
  );
}
