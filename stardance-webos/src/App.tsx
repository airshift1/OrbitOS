import { AuthScreen } from "./shell/AuthScreen";
import { OrbitShell } from "./OrbitShell";
import { IdentityContext, type IdentityController } from "./platform/IdentityContext";
import { useAuthStore } from "./stores/useAuthStore";
import { WebBluetoothProvider } from "./web/bluetooth/WebBluetoothProvider";

export default function App() {
  const user = useAuthStore((state) => state.user);
  const verifyCurrentPassword = useAuthStore((state) => state.verifyCurrentPassword);
  const signOut = useAuthStore((state) => state.signOut);
  const switchToGuest = useAuthStore((state) => state.switchToGuest);

  if (!user) return <AuthScreen />;
  const identity: IdentityController = {
    user,
    verifyPassword: verifyCurrentPassword,
    signOut,
    switchToGuest,
  };

  return (
    <WebBluetoothProvider>
      <IdentityContext.Provider value={identity}>
        <OrbitShell />
      </IdentityContext.Provider>
    </WebBluetoothProvider>
  );
}