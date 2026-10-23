import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { BluetoothContext } from "./bluetooth";
import type { BluetoothAvailability, BluetoothStatus } from "./bluetooth";

interface BrowserBluetoothDevice {
  name?: string;
  gatt?: {
    connected: boolean;
    connect: () => Promise<unknown>;
    disconnect: () => void;
  };
  addEventListener: (type: "gattserverdisconnected", listener: () => void) => void;
  removeEventListener: (type: "gattserverdisconnected", listener: () => void) => void;
}

interface BluetoothManager {
  getAvailability?: () => Promise<boolean>;
  requestDevice: (options: { acceptAllDevices: boolean }) => Promise<BrowserBluetoothDevice>;
}

function getBluetoothManager(): BluetoothManager | undefined {
  if (typeof navigator === "undefined" || !window.isSecureContext) return undefined;
  return (navigator as Navigator & { bluetooth?: BluetoothManager }).bluetooth;
}

function describeError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") return "Bluetooth permission was denied or the device chooser was closed.";
    if (error.name === "SecurityError") return "Bluetooth is blocked by this page's browser permissions.";
    if (error.name === "NotFoundError") return "No Bluetooth device was selected.";
  }
  return "The Bluetooth device could not be connected.";
}

export function BluetoothProvider({ children }: { children: ReactNode }) {
  const deviceRef = useRef<BrowserBluetoothDevice | null>(null);
  const [availability, setAvailability] = useState<BluetoothAvailability>(() =>
    getBluetoothManager() ? "supported" : "unsupported",
  );
  const [status, setStatus] = useState<BluetoothStatus>("idle");
  const [deviceName, setDeviceName] = useState<string>();
  const [message, setMessage] = useState(() => {
    if (getBluetoothManager()) return "Connect a Bluetooth Low Energy device.";
    return window.isSecureContext ? "This browser does not support Web Bluetooth." : "Web Bluetooth requires HTTPS or localhost.";
  });

  const handleDisconnect = useCallback(() => {
    deviceRef.current = null;
    setDeviceName(undefined);
    setStatus("disconnected");
    setMessage("Bluetooth device disconnected.");
  }, []);

  useEffect(() => {
    let cancelled = false;
    const manager = getBluetoothManager();
    if (!manager) return () => { cancelled = true; };
    manager.getAvailability?.().then((available) => {
      if (cancelled) return;
      setAvailability(available ? "supported" : "unavailable");
      setMessage(available ? "Connect a Bluetooth Low Energy device." : "Bluetooth is unavailable on this device or browser.");
    }).catch((error: unknown) => {
      if (cancelled) return;
      console.error("Could not check Bluetooth availability", error);
      setAvailability("supported");
      setMessage("Connect a Bluetooth Low Energy device.");
    });

    return () => {
      cancelled = true;
      const device = deviceRef.current;
      if (device) {
        device.removeEventListener("gattserverdisconnected", handleDisconnect);
        if (device.gatt?.connected) device.gatt.disconnect();
        deviceRef.current = null;
      }
    };
  }, [handleDisconnect]);

  const disconnect = useCallback(() => {
    const device = deviceRef.current;
    if (device) {
      device.removeEventListener("gattserverdisconnected", handleDisconnect);
      if (device.gatt?.connected) device.gatt.disconnect();
    }
    deviceRef.current = null;
    setDeviceName(undefined);
    setStatus("disconnected");
    setMessage("Bluetooth device disconnected.");
  }, [handleDisconnect]);

  const connect = useCallback(async () => {
    const manager = getBluetoothManager();
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
    setMessage("Choose a Bluetooth Low Energy device in the browser prompt.");
    let selectedDevice: BrowserBluetoothDevice | undefined;
    try {
      selectedDevice = await manager.requestDevice({ acceptAllDevices: true });
      if (!selectedDevice.gatt) {
        throw new Error("The selected device does not support Bluetooth GATT connections.");
      }
      const previousDevice = deviceRef.current;
      if (previousDevice) {
        previousDevice.removeEventListener("gattserverdisconnected", handleDisconnect);
        if (previousDevice.gatt?.connected) previousDevice.gatt.disconnect();
      }
      deviceRef.current = selectedDevice;
      selectedDevice.addEventListener("gattserverdisconnected", handleDisconnect);
      await selectedDevice.gatt.connect();
      setDeviceName(selectedDevice.name || "Unnamed device");
      setStatus("connected");
      setMessage("Connected to a Bluetooth Low Energy device.");
    } catch (error) {
      if (selectedDevice) selectedDevice.removeEventListener("gattserverdisconnected", handleDisconnect);
      if (deviceRef.current === selectedDevice) deviceRef.current = null;
      setDeviceName(undefined);
      setStatus(error instanceof DOMException && error.name === "NotFoundError" ? "idle" : "error");
      setMessage(error instanceof Error && error.message.includes("Bluetooth GATT") ? error.message : describeError(error));
    }
  }, [availability, handleDisconnect]);

  const value = useMemo(
    () => ({ availability, status, deviceName, message, connect, disconnect }),
    [availability, status, deviceName, message, connect, disconnect],
  );
  return <BluetoothContext.Provider value={value}>{children}</BluetoothContext.Provider>;
}
