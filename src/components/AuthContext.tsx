"use client";

import { createContext, useContext } from "react";

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthInfo {
  /** null when accounts are switched off and the data simply lives on this device */
  user: AuthUser | null;
  /** signed in from the copy on this device, without being able to reach the server */
  offline: boolean;
}

export const AuthContext = createContext<AuthInfo>({ user: null, offline: false });
export const useAuth = () => useContext(AuthContext);
