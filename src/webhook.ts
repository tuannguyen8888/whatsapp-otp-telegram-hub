import { createServer, type IncomingMessage } from "node:http";
import type { Bot } from "grammy";
import type { HubConfig, NormalizedWhatsAppMessage, TelegramOtpMessage } from "./types.js";
import type { InstanceStore } from "./storage.js";
import { extractOtp } from "./otp.js";
import { sendOtpToTelegram } from "./telegram.js";

export function verifyWebhookSecret(received: string | undefined, expected: string): boolean {
  return received === expected;
}

export function normalizeEvolutionMessage(instanceName: string, payload: unknown): NormalizedWhatsAppMessage | undefined {
  const root = payload as Record<string, unknown>;
  if (root.event !== "MESSAGES_UPSERT") {
    return undefined;
  }

  const data = root.data as Record<string, unknown> | undefined;
  const key = data?.key as Record<string, unknown> | undefined;
  const message = data?.message as Record<string, unknown> | undefined;
  if (!data || key?.fromMe === true) {
    return undefined;
  }

  const text = message?.conversation ?? (message?.extendedTextMessage as Record<string, unknown> | undefined)?.text;
  if (typeof text !== "string" || text.trim() === "") {
    return undefined;
  }

  const rawTimestamp = data.messageTimestamp;
  const timestamp = typeof rawTimestamp === "number"
    ? new Date(rawTimestamp * 1000).toISOString()
    : new Date().toISOString();

  return {
    alias: instanceName,
    instanceName,
    from: typeof key?.remoteJid === "string" ? key.remoteJid : "unknown",
    text,
    timestamp
  };
}

export function createWebhookServer(config: HubConfig, bot: Bot, store: InstanceStore) {
  return createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/webhook/evolution") {
      response.writeHead(404).end();
      return;
    }

    if (!verifyWebhookSecret(request.headers["x-hub-secret"] as string | undefined, config.evolutionWebhookSecret)) {
      response.writeHead(401).end();
      return;
    }

    const payload = JSON.parse(await readBody(request)) as Record<string, unknown>;
    const instanceName = typeof payload.instance === "string" ? payload.instance : "unknown";
    const normalized = normalizeEvolutionMessage(instanceName, payload);
    if (normalized) {
      const instance = await store.get(normalized.alias);
      const telegramMessage: TelegramOtpMessage = {
        otp: extractOtp(normalized.text),
        alias: normalized.alias,
        phoneNumber: instance?.phoneNumber,
        from: normalized.from,
        text: normalized.text
      };
      await sendOtpToTelegram(bot, config.telegramOtpChatId, telegramMessage);
    }

    response.writeHead(204).end();
  });
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}
