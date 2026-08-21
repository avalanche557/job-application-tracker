import type { Response } from "express";

const isProd = process.env.NODE_ENV === "production";

const baseCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
};

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie("access_token", accessToken, {
    ...baseCookieOptions,
    maxAge: 15 * 60 * 1000, // 15m
  });
  res.cookie("refresh_token", refreshToken, {
    ...baseCookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
    path: "/auth/refresh",
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie("access_token", baseCookieOptions);
  res.clearCookie("refresh_token", { ...baseCookieOptions, path: "/auth/refresh" });
}
