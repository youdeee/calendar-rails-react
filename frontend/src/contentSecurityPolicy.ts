/**
 * Builds the Content-Security-Policy meta tag value.
 * When apiBaseUrl is set (production Vercel build), its origin is added to connect-src.
 */
export function buildContentSecurityPolicy(apiBaseUrl?: string): string {
  const connectSrc = ["'self'", "https://accounts.google.com"];
  if (apiBaseUrl?.trim()) {
    try {
      connectSrc.push(new URL(apiBaseUrl.trim()).origin);
    } catch {
      // ignore invalid URL
    }
  }

  const directives = [
    "default-src 'self'",
    "script-src 'self' https://accounts.google.com",
    "frame-src https://accounts.google.com",
    `connect-src ${connectSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://accounts.google.com",
    "img-src 'self' https: data:",
  ];

  return directives.join("; ");
}
