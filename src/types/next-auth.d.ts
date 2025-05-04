// Extend the built-in NextAuth types
import "next-auth";

// Properly extend the session type
declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's ID. */
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

// Extend JWT payload type
declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    /** The user's ID. */
    id: string;
    name?: string | null;
    email?: string | null;
    picture?: string | null;
  }
}
