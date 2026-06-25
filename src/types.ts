export type InstanceStatus = "connected" | "pending_qr" | "disconnected" | "unknown";

export type HubConfig = {
  port: number;
  storagePath: string;
  telegramBotToken: string;
  telegramOtpChatId: string;
  telegramAllowedUserIds: Set<number>;
  evolutionWebhookSecret: string;
  forwardRawMessagesWithoutOtp: boolean;
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

export type NormalizedQrUpdate = {
  alias: string;
  instanceName: string;
  qrBase64?: string;
  pairingCode?: string;
};

export type TelegramOtpMessage = {
  otp?: string;
  alias: string;
  phoneNumber?: string;
  from: string;
  text: string;
};
