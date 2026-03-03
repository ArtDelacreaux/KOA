import TavernMenu from './TavernMenu';
import AuthGate from './components/AuthGate';

export default function App() {
  return (
    <AuthGate>
      <TavernMenu />
    </AuthGate>
  );
}
