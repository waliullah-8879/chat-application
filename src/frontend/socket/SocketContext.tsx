import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../../shared/types";
import { useAuth } from "../auth/AuthContext";

type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type ConnectionState = "offline" | "connecting" | "connected" | "reconnecting";

type SocketContextValue = {
  socket: ChatSocket | null;
  connectionState: ConnectionState;
};

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth();
  const [socket, setSocket] = useState<ChatSocket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("offline");

  useEffect(() => {
    if (!accessToken) {
      setSocket(null);
      setConnectionState("offline");
      return;
    }

    setConnectionState("connecting");

    const nextSocket: ChatSocket = io({
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 700,
      reconnectionDelayMax: 4_000,
    });

    nextSocket.on("connect", () => setConnectionState("connected"));
    nextSocket.io.on("reconnect_attempt", () => setConnectionState("reconnecting"));
    nextSocket.on("disconnect", (reason) => {
      setConnectionState(reason === "io client disconnect" ? "offline" : "reconnecting");
    });
    nextSocket.on("connect_error", () => setConnectionState("reconnecting"));

    setSocket(nextSocket);

    return () => {
      nextSocket.removeAllListeners();
      nextSocket.io.removeAllListeners();
      nextSocket.disconnect();
      setSocket(null);
    };
  }, [accessToken]);

  const value = useMemo(() => ({ socket, connectionState }), [socket, connectionState]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const value = useContext(SocketContext);

  if (!value) {
    throw new Error("useSocket must be used inside SocketProvider.");
  }

  return value;
}
