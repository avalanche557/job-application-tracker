import type { Response } from "express";

const isProd = process.env.NODE_ENV === "production";

// Frontend and backend are on different domains in production, so cookies
// must be SameSite=None to be sent on cross-origin fetch requests - which
// in turn requires Secure. Locally (http, same-origin-ish via Vite proxy-free
// dev) Lax keeps things simple without needing HTTPS.
const baseCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
};

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie("access_token", accessToken, {
    ...baseCookieOptions,
    maxAge: 15 * 60 * 1000, // 15m
  });
  res.cookie("refresh_token", refreshToken, {
    ...baseCookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30d
    path: "/auth/refresh",
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie("access_token", baseCookieOptions);
  res.clearCookie("refresh_token", { ...baseCookieOptions, path: "/auth/refresh" });
}
