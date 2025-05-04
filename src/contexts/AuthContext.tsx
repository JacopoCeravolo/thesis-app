"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { SessionProvider, useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

type AuthContextType = {
  signIn: (credentials: { email: string; password: string }) => Promise<boolean>;
  signUp: (userData: { name: string; email: string; password: string }) => Promise<boolean>;
  logout: () => Promise<void>;
  isLoading: boolean;
  user: any;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  return <SessionProvider>{children}</SessionProvider>;
};

export const ClientAuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isLoading = status === "loading";
  const user = session?.user;

  const handleSignIn = async (credentials: { email: string; password: string }) => {
    try {
      const result = await signIn("credentials", {
        redirect: false,
        email: credentials.email,
        password: credentials.password,
      });

      return !result?.error;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  const handleSignUp = async (userData: { name: string; email: string; password: string }) => {
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Registration failed:", error);
        return false;
      }

      // Auto-login after successful registration
      const signInResult = await handleSignIn({
        email: userData.email,
        password: userData.password,
      });

      return signInResult;
    } catch (error) {
      console.error("Registration error:", error);
      return false;
    }
  };

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        signIn: handleSignIn,
        signUp: handleSignUp,
        logout: handleLogout,
        isLoading,
        user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within a ClientAuthProvider");
  }
  return context;
};
