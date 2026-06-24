import { Bot, InputFile } from "grammy";
import type { InstanceStore } from "./storage.js";
import type { HubConfig, TelegramOtpMessage, WhatsAppInstance } from "./types.js";
import { formatOtpMessage } from "./otp.js";

export const TELEGRAM_COMMANDS = [
  { command: "addwa", description: "Add WhatsApp session and show QR" },
  { command: "qr", description: "Refresh QR for an alias" },
  { command: "listwa", description: "List WhatsApp sessions" },
  { command: "delwa", description: "Delete WhatsApp session" },
  { command: "help", description: "Show command help" }
] as const;

type WhatsAppSessionClient = {
  createInstance: (alias: string, phoneNumber?: string) => Promise<{ qrBase64?: string; pairingCode?: string }>;
  connectInstance: (alias: string, phoneNumber?: string) => Promise<{ qrBase64?: string; pairingCode?: string }>;
  deleteInstance: (alias: string) => Promise<void>;
};

type AdminCommandContext = {
  userId: number;
  text: string;
  allowedUserIds: Set<number>;
  reply: (text: string) => Promise<unknown> | unknown;
  sendPhoto: (qrBase64: string, caption: string) => Promise<unknown> | unknown;
  evolution: WhatsAppSessionClient;
  store: Pick<InstanceStore, "get" | "list" | "upsert" | "delete">;
};

export async function handleAdminCommand(context: AdminCommandContext): Promise<boolean> {
  const [rawCommand, alias, phoneNumber] = context.text.trim().split(/\s+/);
  const command = normalizeCommand(rawCommand);
  if (!command.startsWith("/")) {
    return false;
  }

  if (!context.allowedUserIds.has(context.userId)) {
    await context.reply("Unauthorized");
    return true;
  }

  if (command === "/help" || command === "/start") {
    await context.reply(formatHelpText());
    return true;
  }

  if (command === "/addwa") {
    if (!alias) {
      await context.reply("Usage: /addwa <alias>");
      return true;
    }
    if (await context.store.get(alias)) {
      await context.reply(`Alias ${alias} already exists. Use /qr ${alias} to refresh QR.`);
      return true;
    }

    const qr = await context.evolution.createInstance(alias, phoneNumber);
    const now = new Date().toISOString();
    await context.store.upsert({ alias, instanceName: alias, phoneNumber, status: "pending_qr", createdAt: now, updatedAt: now });
    await sendQr(context, alias, qr.qrBase64, qr.pairingCode);
    return true;
  }

  if (command === "/qr") {
    if (!alias) {
      await context.reply("Usage: /qr <alias>");
      return true;
    }
    const instance = await context.store.get(alias);
    const qr = await context.evolution.connectInstance(alias, instance?.phoneNumber);
    await sendQr(context, alias, qr.qrBase64, qr.pairingCode);
    return true;
  }

  if (command === "/listwa") {
    const instances = await context.store.list();
    await context.reply(formatInstanceList(instances));
    return true;
  }

  if (command === "/delwa") {
    if (!alias) {
      await context.reply("Usage: /delwa <alias>");
      return true;
    }
    await context.evolution.deleteInstance(alias);
    await context.store.delete(alias);
    await context.reply(`Deleted ${alias}`);
    return true;
  }

  return false;
}

function normalizeCommand(command: string): string {
  return command.split("@", 1)[0];
}

export function createTelegramBot(config: HubConfig, evolution: WhatsAppSessionClient, store: InstanceStore): Bot {
  const bot = new Bot(config.telegramBotToken);

  bot.on("message:text", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
      return;
    }

    await handleAdminCommand({
      userId,
      text: ctx.message.text,
      allowedUserIds: config.telegramAllowedUserIds,
      reply: (text) => ctx.reply(text),
      sendPhoto: (qrBase64, caption) => ctx.replyWithPhoto(qrBase64ToInputFile(qrBase64), { caption }),
      evolution,
      store
    });
  });

  return bot;
}

export async function sendOtpToTelegram(bot: Bot, chatId: string, message: TelegramOtpMessage): Promise<void> {
  await bot.api.sendMessage(chatId, formatOtpMessage(message));
}

export async function setupTelegramCommands(bot: Bot): Promise<void> {
  await Promise.all([
    bot.api.setMyCommands(TELEGRAM_COMMANDS),
    bot.api.setMyCommands(TELEGRAM_COMMANDS, { scope: { type: "all_group_chats" } })
  ]);
}

export async function sendQrToTelegram(
  bot: Bot,
  chatId: string,
  alias: string,
  qrBase64?: string,
  pairingCode?: string
): Promise<void> {
  const caption = formatQrCaption(alias, pairingCode);
  if (qrBase64) {
    await bot.api.sendPhoto(chatId, qrBase64ToInputFile(qrBase64), { caption });
    return;
  }
  if (pairingCode) {
    await bot.api.sendMessage(chatId, caption);
  }
}

function formatInstanceList(instances: WhatsAppInstance[]): string {
  if (instances.length === 0) {
    return "No WhatsApp instances yet.";
  }

  return instances.map((instance) => `${instance.alias}: ${instance.status}`).join("\n");
}

function formatHelpText(): string {
  return [
    "WhatsApp OTP Hub commands:",
    "/addwa <alias> - add WhatsApp session and show QR",
    "/addwa <alias> <phoneNumber> - add with pairing code instead of QR",
    "/qr <alias> - refresh QR",
    "/listwa - list sessions",
    "/delwa <alias> - delete session",
    "/help - show this help"
  ].join("\n");
}

function qrBase64ToInputFile(qrBase64: string): InputFile {
  const base64 = qrBase64.includes(",") ? qrBase64.split(",").pop() ?? "" : qrBase64;
  return new InputFile(Buffer.from(base64, "base64"), "whatsapp-qr.png");
}

async function sendQr(context: AdminCommandContext, alias: string, qrBase64?: string, pairingCode?: string): Promise<void> {
  if (qrBase64) {
    await context.sendPhoto(qrBase64, formatQrCaption(alias, pairingCode));
    return;
  }

  if (pairingCode) {
    await context.reply(formatQrCaption(alias, pairingCode));
    return;
  }

  if (!qrBase64) {
    await context.reply(`QR is not available for ${alias}. Try /qr ${alias} again in a few seconds.`);
    return;
  }
}

function formatQrCaption(alias: string, pairingCode?: string): string {
  const lines = [`Scan QR for ${alias}: WhatsApp -> Linked devices -> Link a device`];
  if (pairingCode) {
    lines.push(`Pairing code: ${pairingCode}`);
  }
  return lines.join("\n");
}
