"use client";

import { createContext, useContext } from "react";
import type { CompteSession } from "@/lib/session";

/** Le compte validé appartient au layout courant, jamais à un cache durable. */
export const SessionMembreContext = createContext<{
  compte: CompteSession;
  actualiser: () => void;
} | null>(null);

export function useSessionMembre() {
  return useContext(SessionMembreContext);
}
