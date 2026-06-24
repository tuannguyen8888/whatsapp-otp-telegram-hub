import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config.js";

const validEnv = {
  PORT: "8787",
  HUB_STORAGE_PATH: "./data/instances.json",
  TELEGRAM_BOT_TOKEN: "telegram-token",
  TELEGRAM_OTP_CHAT_ID: "-100123",
  TELEGRAM_ALLOWED_USER_IDS: "111,222",
  EVOLUTION_WEBHOOK_SECRET: "secret"
};

describe("parseConfig", () => {
  it("parses required environment values", () => {
    const config = parseConfig(validEnv);

    expect(config.port).toBe(8787);
    expect(config.telegramAllowedUserIds.has(111)).toBe(true);
    expect(config.telegramAllowedUserIds.has(222)).toBe(true);
  });

  it("throws when a required value is missing", () => {
    const env = { ...validEnv };
    delete env.TELEGRAM_BOT_TOKEN;

    expect(() => parseConfig(env)).toThrow("TELEGRAM_BOT_TOKEN is required");
  });
});
