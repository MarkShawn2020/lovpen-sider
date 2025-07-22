import { DO_UPDATE, DONE_UPDATE, LOCAL_RELOAD_SOCKET_URL } from '../consts.js';
import MessageInterpreter from '../interpreter/index.js';

const checkServerAvailability = async (url: string): Promise<boolean> => {
  try {
    const httpUrl = url.replace('ws://', 'http://').replace('wss://', 'https://');
    const response = await fetch(httpUrl, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache',
    });
    return true;
  } catch {
    return false;
  }
};

export default async ({ id, onUpdate }: { id: string; onUpdate: () => void }) => {
  // Check if HMR server is available before attempting WebSocket connection
  const serverAvailable = await checkServerAvailability(LOCAL_RELOAD_SOCKET_URL);

  if (!serverAvailable) {
    // Silently skip WebSocket connection when HMR server is not running
    return;
  }

  try {
    const ws = new WebSocket(LOCAL_RELOAD_SOCKET_URL);

    ws.onopen = () => {
      ws.addEventListener('message', event => {
        const message = MessageInterpreter.receive(String(event.data));

        if (message.type === DO_UPDATE && message.id === id) {
          onUpdate();
          ws.send(MessageInterpreter.send({ type: DONE_UPDATE }));
        }
      });
    };

    ws.onerror = () => {
      // Silently ignore WebSocket connection errors
    };

    ws.onclose = () => {
      // Silently handle WebSocket close
    };
  } catch (error) {
    // Silently ignore any WebSocket creation errors
  }
};
