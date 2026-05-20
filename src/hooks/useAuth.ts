import { useEffect, useState, useCallback } from "react";

export interface GoogleUser {
  email: string;
  name: string;
  picture: string;
}

const TOKEN_KEY = "r43_google_token";
const USER_KEY = "r43_google_user";
const CLIENT_ID_KEY = "r43_google_client_id";

// Default/fallback client ID for easy user testing, or dynamically read from environment
const ENV_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export function useAuth() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [clientId, setClientId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(CLIENT_ID_KEY) || ENV_CLIENT_ID;
    }
    return ENV_CLIENT_ID;
  });
  const [loading, setLoading] = useState(true);

  // Update client ID and save to local storage
  const updateClientId = (newId: string) => {
    setClientId(newId);
    if (typeof window !== "undefined") {
      localStorage.setItem(CLIENT_ID_KEY, newId);
    }
  };

  // Helper to fetch user details from Google UserInfo endpoint
  const fetchUserInfo = async (token: string): Promise<GoogleUser | null> => {
    try {
      const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        return {
          email: data.email,
          name: data.name || data.email.split("@")[0],
          picture: data.picture || "",
        };
      }
    } catch (e) {
      console.error("Failed to fetch user info", e);
    }
    return null;
  };

  // Initialize and check for existing session
  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);

    if (savedToken && savedUser) {
      setAccessToken(savedToken);
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        setUser(null);
      }
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, []);

  const signIn = useCallback(() => {
    if (!clientId) {
      alert("Please configure a Google OAuth Client ID in Settings first.");
      return;
    }

    setLoading(true);

    try {
      // Initialize the Google Identity Services token client
      // We request read/write permissions for specific files we create
      const client = (window as any).google?.accounts?.oauth2?.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            console.error("Google login failed:", tokenResponse.error);
            setLoading(false);
            return;
          }

          const token = tokenResponse.access_token;
          setAccessToken(token);
          localStorage.setItem(TOKEN_KEY, token);

          // Fetch profile info using token
          const profile = await fetchUserInfo(token);
          if (profile) {
            setUser(profile);
            localStorage.setItem(USER_KEY, JSON.stringify(profile));
          }
          setLoading(false);
        },
      });

      if (client) {
        client.requestAccessToken({ prompt: "consent" });
      } else {
        alert("Google Authentication script not fully loaded yet. Please wait a moment and try again.");
        setLoading(false);
      }
    } catch (error) {
      console.error("Google Auth init failed:", error);
      alert("Error initializing Google Login. Make sure your Client ID is valid.");
      setLoading(false);
    }
  }, [clientId]);

  const signOut = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }, []);

  return {
    accessToken,
    user,
    loading,
    signIn,
    signOut,
    isSignedIn: !!accessToken && !!user,
    clientId,
    updateClientId,
    isConfigured: !!clientId,
  };
}
