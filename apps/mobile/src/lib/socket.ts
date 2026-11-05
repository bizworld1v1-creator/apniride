import { io, type Socket } from 'socket.io-client';
import { api, API_URL } from './api';
import { useAuth } from './auth-store';

let socket: Socket | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * One Socket.IO connection for the whole app. Network drops are retried by socket.io itself
 * (1 s → 10 s backoff). An expired access token is refreshed through the API client, then we reconnect.
 */
export function getSocket(): Socket {
  if (socket) return socket;
  const s = io(API_URL, {
    // WebSocket only: long-polling wastes data on mobile networks.
    transports: ['websocket'],
    autoConnect: false,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    // Read the token on every (re)connect, so a refreshed token is picked up.
    auth: (cb) => cb({ token: useAuth.getState().accessToken ?? '' }),
  });

  s.on('connect_error', (err) => {
    // Server rejected the token → socket.io won't retry by itself.
    if (err.message !== 'unauthorized') return;
    const reconnect = () => {
      if (useAuth.getState().status !== 'signedIn') return;
      // Any authenticated call refreshes the token if needed (or signs out if the session is gone).
      api.me
        .get()
        .then(() => s.connect())
        .catch(() => {
          retryTimer = setTimeout(reconnect, 10_000);
        });
    };
    reconnect();
  });

  socket = s;
  return s;
}

export function disconnectSocket() {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  socket?.disconnect();
}
