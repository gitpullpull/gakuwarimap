import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAuthModeFromEnv,
  getLoginUrl,
  isLoginEnabled,
} from "./const";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("auth helpers", () => {
  it("disables login when oauth envs are missing", () => {
    vi.stubGlobal("window", {
      location: { origin: "https://example.com" },
    });

    const originalEnv = import.meta.env;
    Object.assign(import.meta.env, {
      VITE_OAUTH_PORTAL_URL: "",
      VITE_APP_ID: "",
    });

    expect(getAuthModeFromEnv()).toBe("none");
    expect(isLoginEnabled()).toBe(false);
    expect(getLoginUrl()).toBeNull();

    Object.assign(import.meta.env, originalEnv);
  });
});
