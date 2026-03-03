import TavernMenu from './TavernMenu';
import AuthGate from './components/AuthGate';
import ChatPopoutPage from './components/ChatPopoutPage';

function isChatPopoutRoute() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('chat') === 'popout';
}

export default function App() {
  const chatPopout = isChatPopoutRoute();
  return (
    <AuthGate>
      {chatPopout ? <ChatPopoutPage /> : <TavernMenu />}
    </AuthGate>
  );
}
