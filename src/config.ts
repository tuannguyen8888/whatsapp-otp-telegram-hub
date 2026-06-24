import type { HubConfig } from "./types.js";

function requireString(env: Record<string, string | undefined>, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function parseAllowedUserIds(value: string): Set<number> {
  const ids = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number(part));

  if (ids.length === 0 || ids.some((id) => !Number.isSafeInteger(id))) {
    throw new Error("TELEGRAM_ALLOWED_USER_IDS must contain numeric Telegram user ids");
  }

  return new Set(ids);
}

export function parseConfig(env: Record<string, string | undefined> = process.env): HubConfig {
  return {
    port: Number(env.PORT ?? "8787"),
    storagePath: env.HUB_STORAGE_PATH?.trim() || "./data/instances.json",
    telegramBotToken: requireString(env, "TELEGRAM_BOT_TOKEN"),
    telegramOtpChatId: requireString(env, "TELEGRAM_OTP_CHAT_ID"),
    telegramAllowedUserIds: parseAllowedUserIds(requireString(env, "TELEGRAM_ALLOWED_USER_IDS")),
    evolutionWebhookSecret: env.EVOLUTION_WEBHOOK_SECRET?.trim() || "local-webhook-secret"
  };
}
