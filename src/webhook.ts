import { createServer, type IncomingMessage } from "node:http";
import type { Bot } from "grammy";
import type { HubConfig, NormalizedQrUpdate, NormalizedWhatsAppMessage } from "./types.js";
import type { InstanceStore } from "./storage.js";
import { buildTelegramOtpMessage } from "./forwarding.js";
import { sendOtpToTelegram, sendQrToTelegram } from "./telegram.js";

export function verifyWebhookSecret(received: string | undefined, expected: string): boolean {
  return received === expected;
}

export function normalizeEvolutionMessage(instanceName: string, payload: unknown): NormalizedWhatsAppMessage | undefined {
  const root = payload as Record<string, unknown>;
  if (normalizeEventName(root.event) !== "messages.upsert") {
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

export function normalizeEvolutionQrUpdate(instanceName: string, payload: unknown): NormalizedQrUpdate | undefined {
  const root = payload as Record<string, unknown>;
  if (normalizeEventName(root.event) !== "qrcode.updated") {
    return undefined;
  }

  const data = root.data as Record<string, unknown> | undefined;
  const qrcode = (data?.qrcode ?? root.qrcode) as Record<string, unknown> | undefined;
  const qrBase64 = qrcode?.base64;
  const pairingCode = qrcode?.pairingCode;
  if (typeof qrBase64 !== "string" && typeof pairingCode !== "string") {
    return undefined;
  }

  return {
    alias: instanceName,
    instanceName,
    qrBase64: typeof qrBase64 === "string" ? qrBase64 : undefined,
    pairingCode: typeof pairingCode === "string" ? pairingCode : undefined
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
      const telegramMessage = buildTelegramOtpMessage({
        alias: normalized.alias,
        phoneNumber: instance?.phoneNumber,
        from: normalized.from,
        text: normalized.text
      }, config.forwardRawMessagesWithoutOtp);
      if (telegramMessage) {
        console.log(`Forwarding ${telegramMessage.otp ? "OTP" : "raw"} Evolution message alias=${normalized.alias} from=${normalized.from}`);
        await sendOtpToTelegram(bot, config.telegramOtpChatId, telegramMessage);
      } else {
        console.log(`Dropped non-OTP Evolution message alias=${normalized.alias} from=${normalized.from}`);
      }
    }
    const qrUpdate = normalizeEvolutionQrUpdate(instanceName, payload);
    if (qrUpdate) {
      await markInstancePendingQr(store, qrUpdate.alias);
      await sendQrToTelegram(bot, config.telegramOtpChatId, qrUpdate.alias, qrUpdate.qrBase64, qrUpdate.pairingCode);
    }

    response.writeHead(204).end();
  });
}

function normalizeEventName(event: unknown): string {
  return typeof event === "string" ? event.toLowerCase().replace(/_/g, ".") : "";
}

async function markInstancePendingQr(store: InstanceStore, alias: string): Promise<void> {
  const instance = await store.get(alias);
  if (!instance) {
    return;
  }
  await store.upsert({ ...instance, status: "pending_qr", updatedAt: new Date().toISOString() });
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}
