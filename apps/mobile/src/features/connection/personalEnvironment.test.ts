import { describe, expect, it, vi } from "vite-plus/test";

import { resolvePersonalEnvironmentUrl } from "./personalEnvironment";

vi.mock("expo-constants", () => ({
  default: { expoConfig: { extra: {} } },
}));

describe("resolvePersonalEnvironmentUrl", () => {
  it("normalizes a configured HTTPS endpoint", () => {
    expect(
      resolvePersonalEnvironmentUrl({
        personalEnvironment: { url: " https://personal.example.test/path/?ignored=true#token " },
      }),
    ).toBe("https://personal.example.test/path");
  });

  it("accepts only HTTPS endpoints", () => {
    expect(
      resolvePersonalEnvironmentUrl({
        personalEnvironment: { url: "http://personal.example.test" },
      }),
    ).toBeNull();
    expect(resolvePersonalEnvironmentUrl({ personalEnvironment: { url: "garbage" } })).toBeNull();
  });
});
