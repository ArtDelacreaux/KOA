import React, { useEffect } from 'react';
import PlayerChatDock from './PlayerChatDock';
import styles from './ChatPopoutPage.module.css';

export default function ChatPopoutPage() {
  useEffect(() => {
    if (typeof document === 'undefined') return () => {};
    document.documentElement.classList.add('chat-popout-mode');
    document.body.classList.add('chat-popout-mode');
    return () => {
      document.documentElement.classList.remove('chat-popout-mode');
      document.body.classList.remove('chat-popout-mode');
    };
  }, []);

  return (
    <main className={styles.root}>
      <PlayerChatDock mode="popout" />
    </main>
  );
}
