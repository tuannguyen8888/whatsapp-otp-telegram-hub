import { dirname, join } from "node:path";
import { parseConfig } from "./config.js";
import { InstanceStore } from "./storage.js";
import { createTelegramBot, sendOtpToTelegram, sendQrToTelegram, setupTelegramCommands } from "./telegram.js";
import { createWebhookServer } from "./webhook.js";
import { WhatsAppClient } from "./whatsapp.js";
import { buildTelegramOtpMessage } from "./forwarding.js";

const config = parseConfig();
const store = new InstanceStore(config.storagePath);
const whatsapp = new WhatsAppClient({
  sessionRoot: join(dirname(config.storagePath), "sessions"),
  onQr: async (qr) => {
    await sendQrToTelegram(bot, config.telegramOtpChatId, qr.alias, qr.qrBase64, qr.pairingCode);
  },
  onMessage: async (message) => {
    const instance = await store.get(message.alias);
    const telegramMessage = buildTelegramOtpMessage({
      alias: message.alias,
      phoneNumber: instance?.phoneNumber,
      from: message.from,
      text: message.text
    }, config.forwardRawMessagesWithoutOtp);
    if (!telegramMessage) {
      return;
    }
    await sendOtpToTelegram(bot, config.telegramOtpChatId, telegramMessage);
  },
  onStatus: async (alias, status) => {
    const instance = await store.get(alias);
    if (instance) {
      await store.upsert({ ...instance, status, updatedAt: new Date().toISOString() });
    }
  }
});
const bot = createTelegramBot(config, whatsapp, store);
const server = createWebhookServer(config, bot, store);

await setupTelegramCommands(bot);

server.listen(config.port, () => {
  console.log(`WhatsApp OTP Telegram hub listening on ${config.port}`);
});

void bot.start({ drop_pending_updates: true });
void whatsapp.restore(await store.list());
