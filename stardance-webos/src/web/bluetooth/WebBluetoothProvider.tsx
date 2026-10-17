import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { BluetoothContext, type BluetoothAvailability, type BluetoothController, type BluetoothStatus } from "../../platform/BluetoothContext";

interface WebBluetoothDevice {
  name?: string;
  gatt?: {
    connected: boolean;
    connect: () => Promise<unknown>;
    disconnect: () => void;
  };
  addEventListener: (type: "gattserverdisconnected", listener: () => void) => void;
  removeEventListener: (type: "gattserverdisconnected", listener: () => void) => void;
}

interface WebBluetoothManager {
  getAvailability?: () => Promise<boolean>;
  getDevices?: () => Promise<WebBluetoothDevice[]>;
  requestDevice: (options: { acceptAllDevices: boolean }) => Promise<WebBluetoothDevice>;
}

type BluetoothNavigator = Navigator & { bluetooth?: WebBluetoothManager };

function getManager(): WebBluetoothManager | undefined {
  if (typeof navigator === "undefined" || !window.isSecureContext) return undefined;
  return (navigator as BluetoothNavigator).bluetooth;
}

function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") return "Bluetooth permission was denied.";
  if (error instanceof DOMException && error.name === "SecurityError") return "Bluetooth is blocked in this secure context.";
  return "The Bluetooth device could not be connected.";
}

export function WebBluetoothProvider({ children }: { children: ReactNode }) {
  const deviceRef = useRef<WebBluetoothDevice | null>(null);
  const [availability, setAvailability] = useState<BluetoothAvailability>("unsupported");
  const [status, setStatus] = useState<BluetoothStatus>("idle");
  const [deviceName, setDeviceName] = useState<string>();
  const [message, setMessage] = useState("Checking browser Bluetooth support…");

  useEffect(() => {
    let cancelled = false;
    const manager = getManager();
    if (!manager) {
      setAvailability("unsupported");
      setMessage(window.isSecureContext ? "This browser does not support Web Bluetooth." : "Web Bluetooth requires HTTPS or localhost.");
      return () => { cancelled = true; };
    }
    manager.getAvailability?.().then((available) => {
      if (cancelled) return;
      setAvailability(available ? "supported" : "unavailable");
      setMessage(available ? "Connect a compatible Bluetooth Low Energy device." : "Bluetooth is unavailable on this device or browser.");
    }).catch(() => {
      if (!cancelled) {
        setAvailability("supported");
        setMessage("Connect a compatible Bluetooth Low Energy device.");
      }
    });
    manager.getDevices?.().catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const disconnect = useCallback(() => {
    const device = deviceRef.current;
    if (device?.gatt?.connected) device.gatt.disconnect();
    deviceRef.current = null;
    setDeviceName(undefined);
    setStatus("disconnected");
    setMessage("Bluetooth device disconnected.");
  }, []);

  const connect = useCallback(async () => {
    const manager = getManager();
    if (!manager) {
      setAvailability("unsupported");
      setStatus("error");
      setMessage(window.isSecureContext ? "This browser does not support Web Bluetooth." : "Web Bluetooth requires HTTPS or localhost.");
      return;
    }
    if (availability === "unavailable") {
      setStatus("error");
      setMessage("Bluetooth is unavailable on this device or browser.");
      return;
    }
    setStatus("requesting");
    setMessage("Choose a compatible Bluetooth Low Energy device in your browser.");
    try {
      const device = await manager.requestDevice({ acceptAllDevices: true });
      if (!device.gatt) throw new Error("GATT is unavailable for this device.");
      deviceRef.current?.removeEventListener("gattserverdisconnected", disconnect);
      deviceRef.current = device;
      device.addEventListener("gattserverdisconnected", disconnect);
      await device.gatt.connect();
      setDeviceName(device.name || "Device name not provided");
      setStatus("connected");
      setMessage("Connected to a Bluetooth Low Energy device.");
    } catch (error) {
      if (deviceRef.current) deviceRef.current.removeEventListener("gattserverdisconnected", disconnect);
      deviceRef.current = null;
      setDeviceName(undefined);
      setStatus("error");
      setMessage(errorMessage(error));
    }
  }, [availability, disconnect]);

  const value = useMemo<BluetoothController>(() => ({ availability, status, deviceName, message, connect, disconnect }), [availability, status, deviceName, message, connect, disconnect]);
  return <BluetoothContext.Provider value={value}>{children}</BluetoothContext.Provider>;
}
