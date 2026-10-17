import { DesktopIdentityProvider } from "./DesktopIdentity";
import { DesktopBluetoothProvider } from "./DesktopBluetoothProvider";
import { OrbitShell } from "../OrbitShell";

export default function DesktopApp() {
  return <DesktopBluetoothProvider><DesktopIdentityProvider><OrbitShell /></DesktopIdentityProvider></DesktopBluetoothProvider>;
}
