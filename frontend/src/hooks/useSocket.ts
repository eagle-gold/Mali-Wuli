"use client";

import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";

let socketSingleton: Socket | null = null;
let jetonSocket = "";

function origineSocket() {
  const urlConfiguree = process.env.NEXT_PUBLIC_SOCKET_URL?.trim();
  if (urlConfiguree) return urlConfiguree.replace(/\/+$/, "");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8002/api";
  return apiUrl.replace(/\/+$/, "").replace(/\/api$/, "");
}

function lireJeton() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("mali_wuli_token")?.trim() || "";
}

export function getSocket() {
  if (typeof window === "undefined") {
    throw new Error("La connexion temps réel est uniquement disponible dans le navigateur.");
  }

  const jeton = lireJeton();
  if (!socketSingleton) {
    socketSingleton = io(origineSocket(), {
      autoConnect: false,
      auth: { token: jeton },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5_000,
      timeout: 10_000,
    });
    jetonSocket = jeton;
  } else if (jetonSocket !== jeton) {
    socketSingleton.auth = { token: jeton };
    jetonSocket = jeton;
    if (socketSingleton.connected) socketSingleton.disconnect();
  }

  if (!socketSingleton.connected) socketSingleton.connect();
  return socketSingleton;
}

export function fermerSocket() {
  socketSingleton?.disconnect();
  socketSingleton = null;
  jetonSocket = "";
}

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const connexion = getSocket();
    setSocket(connexion);
    return () => {
      setSocket(null);
    };
  }, []);

  return socket;
}
