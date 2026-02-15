(function () {
  const SESSION_KEY = "memoflix_supabase_session_v1";
  const cfg = window.APP_CONFIG || {};
  const supabaseUrl = String(cfg.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const supabaseAnonKey = String(cfg.SUPABASE_ANON_KEY || "").trim();
  const cloudEnabled = Boolean(supabaseUrl && supabaseAnonKey);

  const authHeaders = (accessToken) => {
    const headers = {
      apikey: supabaseAnonKey,
      "Content-Type": "application/json"
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    return headers;
  };

  const getSession = () => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      const parsed = JSON.parse(raw || "null");
      if (!parsed || typeof parsed !== "object") {
        return null;
      }
      if (!parsed.access_token || !parsed.user?.id) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  };

  const setSession = (session) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  };

  const clearSession = () => {
    localStorage.removeItem(SESSION_KEY);
  };

  const getCurrentUser = () => {
    const session = getSession();
    if (!session?.user) {
      return null;
    }
    const displayName =
      session.user.user_metadata?.display_name ||
      session.user.user_metadata?.name ||
      session.user.email;
    return {
      id: session.user.id,
      email: session.user.email,
      name: displayName
    };
  };

  const authRequest = async (path, options = {}) => {
    if (!cloudEnabled) {
      throw new Error("Supabase config belum diisi.");
    }
    const res = await fetch(`${supabaseUrl}${path}`, options);
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const msg =
        (data && (data.msg || data.message || data.error_description || data.error)) ||
        `Request gagal (${res.status})`;
      throw new Error(msg);
    }
    return data;
  };

  const signUp = async ({ name, email, password }) => {
    const data = await authRequest("/auth/v1/signup", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        email,
        password,
        data: {
          display_name: name
        }
      })
    });
    if (data?.session) {
      setSession(data.session);
    }
    return data;
  };

  const signIn = async ({ email, password }) => {
    const data = await authRequest("/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email, password })
    });
    const session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      token_type: data.token_type,
      user: data.user
    };
    setSession(session);
    return session;
  };

  const signOut = async () => {
    const session = getSession();
    if (session?.access_token) {
      try {
        await authRequest("/auth/v1/logout", {
          method: "POST",
          headers: authHeaders(session.access_token)
        });
      } catch {
        // Keep local clear even if remote logout fails.
      }
    }
    clearSession();
  };

  const upsertProfile = async () => {
    const session = getSession();
    const user = getCurrentUser();
    if (!session?.access_token || !user?.id) {
      return;
    }
    await authRequest("/rest/v1/user_profiles", {
      method: "POST",
      headers: {
        ...authHeaders(session.access_token),
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify({
        user_id: user.id,
        display_name: user.name,
        email: user.email
      })
    });
  };

  window.MemoflixAuth = {
    cloudEnabled,
    supabaseUrl,
    supabaseAnonKey,
    authHeaders,
    getSession,
    getCurrentUser,
    signUp,
    signIn,
    signOut,
    upsertProfile,
    clearSession
  };
})();
