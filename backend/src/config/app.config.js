// Purpose: Application-level feature flags read from the environment.
// Each flag is parsed once here, when this module is first required, so
// every part of the app sees the same value.

// Parse an environment variable that must be "true" or "false"
// (case-insensitive, surrounding whitespace ignored). Unset or empty values
// use the default. Anything else also uses the default, with a warning, so
// a typo can't silently change behaviour.
function parseBooleanEnv(name, defaultValue) {
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue.trim() === "") {
    return defaultValue;
  }

  const normalized = rawValue.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  console.warn(
    `[Config] Invalid ${name}="${rawValue}". Expected "true" or "false". Using default: ${defaultValue}.`,
  );

  return defaultValue;
}

const appConfig = Object.freeze({
  // true:  new users wait for an admin to approve them in the dashboard.
  // false: new users are approved at sign-up, and users still pending are
  //        approved automatically the next time they sign in (GET /auth/me).
  needAdminApproval: parseBooleanEnv("NEED_ADMIN_APPROVAL", false),
});

module.exports = appConfig;
