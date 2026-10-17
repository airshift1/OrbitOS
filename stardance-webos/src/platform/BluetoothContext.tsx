import { createContext, useContext } from "react";

export type BluetoothAvailability = "supported" | "unsupported" | "unavailable";
export type BluetoothStatus = "idle" | "requesting" | "connected" | "disconnected" | "error";

export interface BluetoothController {
  availability: BluetoothAvailability;
  status: BluetoothStatus;
  deviceName?: string;
  message: string;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export const BluetoothContext = createContext<BluetoothController | null>(null);

export function useBluetooth(): BluetoothController {
  const bluetooth = useContext(BluetoothContext);
  if (!bluetooth) throw new Error("OrbitOS Bluetooth context is unavailable");
  return bluetooth;
}
