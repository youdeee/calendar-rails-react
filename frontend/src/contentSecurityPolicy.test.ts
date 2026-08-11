import { buildContentSecurityPolicy } from "./contentSecurityPolicy";

it("does not include a Render API origin in connect-src when apiBaseUrl is unset", () => {
  const csp = buildContentSecurityPolicy();
  expect(csp).toContain("connect-src 'self' https://accounts.google.com");
  expect(csp).not.toContain("onrender.com");
});

it("includes the API origin in connect-src when apiBaseUrl is set", () => {
  const csp = buildContentSecurityPolicy("https://calendar-rails-react.onrender.com");
  expect(csp).toContain(
    "connect-src 'self' https://accounts.google.com https://calendar-rails-react.onrender.com",
  );
});

it("allows Google Sign-In styles in style-src", () => {
  const csp = buildContentSecurityPolicy();
  expect(csp).toContain("style-src 'self' 'unsafe-inline' https://accounts.google.com");
});

it("ignores invalid apiBaseUrl", () => {
  const csp = buildContentSecurityPolicy("not-a-url");
  expect(csp).toContain("connect-src 'self' https://accounts.google.com");
  expect(csp).not.toContain("not-a-url");
});
