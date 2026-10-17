import { getIcon } from "../lib/icons";
import type { AppId } from "../types";
import { useSystemStore } from "../stores/useSystemStore";

interface AppIconProps {
  icon: string;
  size?: number;
  className?: string;
  appId?: AppId;
}

/** Monochrome icon tile used by the taskbar, Start menu, launcher and desktop. */
export function AppIcon({ icon, size = 36, className, appId }: AppIconProps) {
  const override = useSystemStore((s) => appId ? s.customization.iconOverrides[appId] : undefined);
  const Icon = getIcon(override ?? icon);
  return (
    <span className={`app-icon ${className ?? ""}`} aria-hidden="true" style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.5)} strokeWidth={1.6} />
    </span>
  );
}
