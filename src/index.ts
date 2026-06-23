import { parseConfig } from "./config.js";
import { EvolutionClient } from "./evolution.js";
import { InstanceStore } from "./storage.js";
import { createTelegramBot } from "./telegram.js";
import { createWebhookServer } from "./webhook.js";

const config = parseConfig();
const store = new InstanceStore(config.storagePath);
const evolution = new EvolutionClient({
  baseUrl: config.evolutionApiBaseUrl,
  apiKey: config.evolutionApiKey,
  webhookUrl: `${config.publicUrl}/webhook/evolution`,
  webhookSecret: config.evolutionWebhookSecret
});
const bot = createTelegramBot(config, evolution, store);
const server = createWebhookServer(config, bot, store);

server.listen(config.port, () => {
  console.log(`WhatsApp OTP Telegram hub listening on ${config.port}`);
});

void bot.start({ drop_pending_updates: true });
