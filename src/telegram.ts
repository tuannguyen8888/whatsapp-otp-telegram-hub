import { Bot, InputFile } from "grammy";
import type { EvolutionClient } from "./evolution.js";
import type { InstanceStore } from "./storage.js";
import type { HubConfig, TelegramOtpMessage, WhatsAppInstance } from "./types.js";
import { formatOtpMessage } from "./otp.js";

type AdminCommandContext = {
  userId: number;
  text: string;
  allowedUserIds: Set<number>;
  reply: (text: string) => Promise<unknown> | unknown;
  sendPhoto: (qrBase64: string, caption: string) => Promise<unknown> | unknown;
  evolution: Pick<EvolutionClient, "createInstance" | "connectInstance" | "deleteInstance">;
  store: Pick<InstanceStore, "get" | "list" | "upsert" | "delete">;
};

export async function handleAdminCommand(context: AdminCommandContext): Promise<boolean> {
  const [command, alias] = context.text.trim().split(/\s+/);
  if (!command.startsWith("/")) {
    return false;
  }

  if (!context.allowedUserIds.has(context.userId)) {
    await context.reply("Unauthorized");
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

    const qr = await context.evolution.createInstance(alias);
    const now = new Date().toISOString();
    await context.store.upsert({ alias, instanceName: alias, status: "pending_qr", createdAt: now, updatedAt: now });
    await sendQr(context, alias, qr.qrBase64);
    return true;
  }

  if (command === "/qr") {
    if (!alias) {
      await context.reply("Usage: /qr <alias>");
      return true;
    }
    const qr = await context.evolution.connectInstance(alias);
    await sendQr(context, alias, qr.qrBase64);
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

export function createTelegramBot(config: HubConfig, evolution: EvolutionClient, store: InstanceStore): Bot {
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

function formatInstanceList(instances: WhatsAppInstance[]): string {
  if (instances.length === 0) {
    return "No WhatsApp instances yet.";
  }

  return instances.map((instance) => `${instance.alias}: ${instance.status}`).join("\n");
}

function qrBase64ToInputFile(qrBase64: string): InputFile {
  const base64 = qrBase64.includes(",") ? qrBase64.split(",").pop() ?? "" : qrBase64;
  return new InputFile(Buffer.from(base64, "base64"), "whatsapp-qr.png");
}

async function sendQr(context: AdminCommandContext, alias: string, qrBase64?: string): Promise<void> {
  if (!qrBase64) {
    await context.reply(`QR is not available for ${alias}. Try /qr ${alias} again in a few seconds.`);
    return;
  }

  await context.sendPhoto(qrBase64, `Scan QR for ${alias}: WhatsApp -> Linked devices -> Link a device`);
}
