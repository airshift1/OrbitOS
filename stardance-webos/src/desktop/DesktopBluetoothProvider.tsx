import type { ReactNode } from "react";
import { BluetoothContext } from "../platform/BluetoothContext";

export function DesktopBluetoothProvider({ children }: { children: ReactNode }) {
  const value = {
    availability: "unsupported" as const,
    status: "idle" as const,
    message: "Bluetooth is not part of the web renderer. The future desktop shell will provide its own native adapter.",
    connect: async () => undefined,
    disconnect: () => undefined,
  };
  return <BluetoothContext.Provider value={value}>{children}</BluetoothContext.Provider>;
}
