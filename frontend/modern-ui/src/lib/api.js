/**
 * API client.
 *
 * Responsibilities:
 *   - attach the access token to every request
 *   - transparently refresh an expired access token exactly once per failure,
 *     queueing concurrent callers so a burst of 401s triggers one refresh
 *   - surface a single "unauthorised" signal when the session is truly gone
 *
 * All requests are relative ("/api/..."), so the Vite dev-server proxy or any
 * production reverse proxy forwards them to the backend. The browser never
 * needs to know the API host.
 */

const ACCESS_TOKEN_KEY = "sc_access_token";
const REFRESH_TOKEN_KEY = "sc_refresh_token";
const USER_KEY = "sc_user";

// ------------------------------------------------------
// Token storage
// ------------------------------------------------------

export const tokenStore = {
    getAccess: () => localStorage.getItem(ACCESS_TOKEN_KEY) || "",
    getRefresh: () => localStorage.getItem(REFRESH_TOKEN_KEY) || "",

    getUser: () => {
        try {
            const raw = localStorage.getItem(USER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },

    set: ({ token, refreshToken, user }) => {
        if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token);
        if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    },

    clear: () => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }
};

// ------------------------------------------------------
// Session-expiry broadcast
// ------------------------------------------------------

const unauthorizedHandlers = new Set();

export const onUnauthorized = (handler) => {
    unauthorizedHandlers.add(handler);
    return () => unauthorizedHandlers.delete(handler);
};

const emitUnauthorized = () => {
    tokenStore.clear();
    unauthorizedHandlers.forEach((handler) => {
        try {
            handler();
        } catch {
            /* a failing listener must not block the others */
        }
    });
};

// ------------------------------------------------------
// Errors
// ------------------------------------------------------

export class ApiError extends Error {
    constructor(message, status, payload) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.payload = payload;
    }
}

// ------------------------------------------------------
// Refresh coordination
// ------------------------------------------------------
//
// A single in-flight refresh is shared by every caller that hits a 401 at the
// same moment, so one expired token cannot cause a stampede of refresh calls
// (each of which would rotate and invalidate the others).

let refreshPromise = null;

const performRefresh = async () => {
    const refreshToken = tokenStore.getRefresh();

    if (!refreshToken) {
        return null;
    }

    const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken })
    });

    if (!response.ok) {
        return null;
    }

    const payload = await response.json().catch(() => null);

    if (!payload || !payload.token) {
        return null;
    }

    tokenStore.set({
        token: payload.token,
        refreshToken: payload.refreshToken,
        user: payload.user
    });

    return payload.token;
};

const refreshAccessToken = () => {
    if (!refreshPromise) {
        refreshPromise = performRefresh()
            .catch(() => null)
            .finally(() => {
                // Release the lock on the next tick so queued callers all read
                // the settled value before a new refresh can start.
                setTimeout(() => {
                    refreshPromise = null;
                }, 0);
            });
    }

    return refreshPromise;
};

// ------------------------------------------------------
// Core request
// ------------------------------------------------------

const buildHeaders = (options, token) => {
    const headers = { ...(options.headers || {}) };

    if (!(options.body instanceof FormData) && options.body !== undefined) {
        headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return headers;
};

const request = async (endpoint, options = {}, { retry = true } = {}) => {
    const url = endpoint.startsWith("/api") ? endpoint : `/api${endpoint}`;

    const body =
        options.body && typeof options.body === "object" && !(options.body instanceof FormData)
            ? JSON.stringify(options.body)
            : options.body;

    let response;

    try {
        response = await fetch(url, {
            ...options,
            body,
            headers: buildHeaders(options, tokenStore.getAccess())
        });
    } catch (networkError) {
        throw new ApiError(
            "Network error — could not reach the server.",
            0,
            null
        );
    }

    // Access token expired: refresh once, then replay the original request.
    if (response.status === 401 && retry) {
        const newToken = await refreshAccessToken();

        if (newToken) {
            return request(endpoint, options, { retry: false });
        }

        emitUnauthorized();

        throw new ApiError("Your session has expired. Please sign in again.", 401, null);
    }

    if (response.status === 204) {
        return null;
    }

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
        const text = await response.text();

        if (!response.ok) {
            throw new ApiError(text || `Request failed (${response.status})`, response.status, null);
        }

        return text;
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new ApiError(
            payload.message || `Request failed (${response.status})`,
            response.status,
            payload
        );
    }

    return payload;
};

// ------------------------------------------------------
// Verbs
// ------------------------------------------------------

export const api = {
    get: (endpoint, options) => request(endpoint, { ...options, method: "GET" }),
    post: (endpoint, body, options) => request(endpoint, { ...options, method: "POST", body }),
    patch: (endpoint, body, options) => request(endpoint, { ...options, method: "PATCH", body }),
    put: (endpoint, body, options) => request(endpoint, { ...options, method: "PUT", body }),
    delete: (endpoint, options) => request(endpoint, { ...options, method: "DELETE" }),

    /**
     * Download an endpoint's response as a file (used by CSV export).
     */
    download: async (endpoint, filename) => {
        const url = endpoint.startsWith("/api") ? endpoint : `/api${endpoint}`;

        let response = await fetch(url, {
            headers: { Authorization: `Bearer ${tokenStore.getAccess()}` }
        });

        if (response.status === 401) {
            const newToken = await refreshAccessToken();

            if (!newToken) {
                emitUnauthorized();
                throw new ApiError("Your session has expired. Please sign in again.", 401, null);
            }

            response = await fetch(url, {
                headers: { Authorization: `Bearer ${newToken}` }
            });
        }

        if (!response.ok) {
            throw new ApiError(`Export failed (${response.status})`, response.status, null);
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = filename || "export.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(objectUrl);
    }
};

// ------------------------------------------------------
// Auth helpers
// ------------------------------------------------------

export const authApi = {
    login: async (email, password) => {
        const payload = await request(
            "/auth/login",
            { method: "POST", body: { email, password } },
            { retry: false }
        );

        tokenStore.set({
            token: payload.token,
            refreshToken: payload.refreshToken,
            user: payload.user
        });

        return payload.user;
    },

    register: async (details) => {
        const payload = await request(
            "/auth/register",
            { method: "POST", body: details },
            { retry: false }
        );

        tokenStore.set({
            token: payload.token,
            refreshToken: payload.refreshToken,
            user: payload.user
        });

        return payload.user;
    },

    logout: async () => {
        const refreshToken = tokenStore.getRefresh();

        try {
            if (refreshToken) {
                await fetch("/api/auth/logout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refreshToken })
                });
            }
        } finally {
            tokenStore.clear();
        }
    },

    me: () => api.get("/auth/me"),
    forgotPassword: (email) =>
        request("/auth/forgot-password", { method: "POST", body: { email } }, { retry: false }),
    resetPassword: (token, password) =>
        request("/auth/reset-password", { method: "POST", body: { token, password } }, { retry: false }),
    verifyEmail: (token) =>
        request("/auth/verify-email", { method: "POST", body: { token } }, { retry: false }),
    resendVerification: () => api.post("/auth/resend-verification"),
    sessions: () => api.get("/auth/sessions"),
    revokeSession: (id) => api.delete(`/auth/sessions/${id}`),
    revokeAllSessions: () =>
        api.post("/auth/sessions/revoke-all", { refreshToken: tokenStore.getRefresh() })
};

export { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY };
