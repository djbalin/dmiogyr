// Shared by the server layout (the pre-paint script) and the client settings
// menu, so it must not live in a "use client" module: a server component
// importing a constant from one gets a client reference, not the value.

export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "dmiogyr:theme";

/**
 * Runs in <head> before the first paint, so a pinned theme is applied before
 * anything is drawn instead of flashing the OS theme first. Kept tiny and
 * dependency-free because it is inlined as a string.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
