export type InstanceStatus = "connected" | "pending_qr" | "disconnected" | "unknown";

export type HubConfig = {
  port: number;
  publicUrl: string;
  storagePath: string;
  telegramBotToken: string;
  telegramOtpChatId: string;
  telegramAllowedUserIds: Set<number>;
  evolutionApiBaseUrl: string;
  evolutionApiKey: string;
  evolutionWebhookSecret: string;
};

export type WhatsAppInstance = {
  alias: string;
  instanceName: string;
  phoneNumber?: string;
  status: InstanceStatus;
  createdAt: string;
  updatedAt: string;
};

export type NormalizedWhatsAppMessage = {
  alias: string;
  instanceName: string;
  from: string;
  text: string;
  timestamp: string;
};

export type TelegramOtpMessage = {
  otp?: string;
  alias: string;
  phoneNumber?: string;
  from: string;
  text: string;
};
