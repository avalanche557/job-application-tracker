import { google } from "googleapis";

const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

export function generateGoogleAuthUrl(state: string): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // ensures a refresh_token is returned even on reconnect
    scope: [GMAIL_READONLY_SCOPE, "https://www.googleapis.com/auth/userinfo.email"],
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();

  return {
    email: data.email!,
    refreshToken: tokens.refresh_token,
    scope: tokens.scope ?? GMAIL_READONLY_SCOPE,
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
  };
}
