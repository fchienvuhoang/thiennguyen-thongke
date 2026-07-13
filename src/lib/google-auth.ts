import { OAuth2Client } from "google-auth-library";

export const GOOGLE_OAUTH_STATE_COOKIE = "thienphap_google_oauth_state";
export const GOOGLE_OAUTH_VERIFIER_COOKIE = "thienphap_google_oauth_verifier";
const PUBLIC_APP_URL = "https://thiennguyen-thongke.vercel.app";
const ALLOWED_GOOGLE_ORIGINS = new Set([
  PUBLIC_APP_URL,
  "http://localhost:3000",
  "http://localhost:3001",
]);

export function googleAuthConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
}

export function googleRedirectUri(origin: string) {
  const requestOrigin = origin.replace(/\/$/, "");
  const configuredOrigin = (process.env.APP_URL || PUBLIC_APP_URL).replace(
    /\/$/,
    "",
  );
  const baseUrl = ALLOWED_GOOGLE_ORIGINS.has(requestOrigin)
    ? requestOrigin
    : configuredOrigin;
  return `${baseUrl}/api/auth/google/callback`;
}

export function googleOAuthClient(origin: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth chưa được cấu hình");
  }
  return new OAuth2Client(
    clientId,
    clientSecret,
    googleRedirectUri(origin),
  );
}
