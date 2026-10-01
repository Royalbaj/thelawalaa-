// Read by the POS layout (server) and written by the theme toggle (client).
// Lives outside the "use client" module: a constant exported from there
// reaches server code as a client reference, not as the string.
export const POS_THEME_COOKIE = "pos-theme";
