import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WAMessage,
  type WASocket
} from "baileys";
import pino from "pino";
import QRCode from "qrcode";
import type { NormalizedQrUpdate, NormalizedWhatsAppMessage, WhatsAppInstance } from "./types.js";

type QrResult = {
  qrBase64?: string;
  pairingCode?: string;
};

type WhatsAppClientOptions = {
  sessionRoot: string;
  onQr?: (qr: NormalizedQrUpdate) => Promise<void> | void;
  onMessage?: (message: NormalizedWhatsAppMessage) => Promise<void> | void;
  onStatus?: (alias: string, status: "connected" | "pending_qr" | "disconnected") => Promise<void> | void;
};

type PendingQrWaiter = {
  resolve: (qr: QrResult) => void;
  timeout: NodeJS.Timeout;
};

type PairingSocket = Pick<WASocket, "requestPairingCode">;

type PairingRetryOptions = {
  retries?: number;
  delayMs?: number;
};

export class WhatsAppClient {
  private readonly sockets = new Map<string, WASocket>();
  private readonly qrWaiters = new Map<string, PendingQrWaiter>();
  private readonly logger = pino({ level: "silent" });

  constructor(private readonly options: WhatsAppClientOptions) {}

  async restore(instances: WhatsAppInstance[]): Promise<void> {
    await mkdir(this.options.sessionRoot, { recursive: true });
    await Promise.all(instances.map(async (instance) => {
      try {
        await this.startSocket(instance.alias, instance.phoneNumber, false);
      } catch (error) {
        console.error(`Failed to restore WhatsApp instance ${instance.alias}:`, error);
      }
    }));
  }

  async createInstance(alias: string, phoneNumber?: string): Promise<QrResult> {
    return this.startSocket(alias, phoneNumber, true);
  }

  async connectInstance(alias: string, phoneNumber?: string): Promise<QrResult> {
    return this.startSocket(alias, phoneNumber, true);
  }

  async deleteInstance(alias: string): Promise<void> {
    const socket = this.sockets.get(alias);
    this.sockets.delete(alias);
    this.clearQrWaiter(alias);
    try {
      await socket?.logout();
    } catch {
      socket?.end(new Error("Instance deleted"));
    }
    await rm(this.sessionPath(alias), { recursive: true, force: true });
    await this.options.onStatus?.(alias, "disconnected");
  }

  private async startSocket(alias: string, phoneNumber: string | undefined, waitForQr: boolean): Promise<QrResult> {
    const existingSocket = this.sockets.get(alias);
    if (existingSocket) {
      existingSocket.end(new Error("Restarting WhatsApp socket"));
      this.sockets.delete(alias);
    }

    const qrPromise = waitForQr ? this.waitForQr(alias) : Promise.resolve({});
    const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath(alias));
    const { version } = await fetchLatestBaileysVersion();
    const socket = makeWASocket({
      auth: state,
      browser: Browsers.ubuntu("Chrome"),
      logger: this.logger,
      markOnlineOnConnect: false,
      printQRInTerminal: false,
      syncFullHistory: false,
      version
    });

    this.sockets.set(alias, socket);
    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", async (update) => {
      if (update.qr) {
        const qrBase64 = await QRCode.toDataURL(update.qr, {
          errorCorrectionLevel: "H",
          margin: 3,
          scale: 4
        });
        this.resolveQr(alias, { qrBase64 });
        await this.options.onStatus?.(alias, "pending_qr");
      }

      if (update.connection === "open") {
        await this.options.onStatus?.(alias, "connected");
        return;
      }

      if (update.connection === "close") {
        const statusCode = (update.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
        if (statusCode === DisconnectReason.loggedOut) {
          await this.options.onStatus?.(alias, "disconnected");
          return;
        }
        void this.startSocket(alias, phoneNumber, false);
      }
    });
    socket.ev.on("messages.upsert", async ({ messages }) => {
      for (const message of messages) {
        try {
          const normalized = normalizeBaileysMessage(alias, message);
          if (normalized) {
            await this.options.onMessage?.(normalized);
          }
        } catch (error) {
          console.error(`Failed to process WhatsApp message for ${alias}:`, error);
        }
      }
    });

    if (phoneNumber) {
      void this.requestPairingCode(socket, alias, phoneNumber);
    }

    return qrPromise;
  }

  private async requestPairingCode(socket: WASocket, alias: string, phoneNumber: string): Promise<void> {
    try {
      const pairingCode = await requestPairingCodeWithRetry(socket, phoneNumber);
      this.resolveQr(alias, { pairingCode });
    } catch (error) {
      console.error(`Failed to request pairing code for ${alias}:`, error);
    }
  }

  private waitForQr(alias: string): Promise<QrResult> {
    this.clearQrWaiter(alias);
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.qrWaiters.delete(alias);
        resolve({});
      }, 20000);
      this.qrWaiters.set(alias, { resolve, timeout });
    });
  }

  private resolveQr(alias: string, qr: QrResult): void {
    const waiter = this.qrWaiters.get(alias);
    if (!waiter) {
      return;
    }

    clearTimeout(waiter.timeout);
    this.qrWaiters.delete(alias);
    waiter.resolve(qr);
  }

  private clearQrWaiter(alias: string): void {
    const waiter = this.qrWaiters.get(alias);
    if (waiter) {
      clearTimeout(waiter.timeout);
      this.qrWaiters.delete(alias);
      waiter.resolve({});
    }
  }

  private sessionPath(alias: string): string {
    return join(this.options.sessionRoot, alias);
  }
}

export function normalizeBaileysMessage(alias: string, message: unknown): NormalizedWhatsAppMessage | undefined {
  const whatsappMessage = message as WAMessage;
  if (whatsappMessage.key.fromMe) {
    return undefined;
  }

  const text = extractText(whatsappMessage);
  if (!text) {
    return undefined;
  }

  return {
    alias,
    instanceName: alias,
    from: whatsappMessage.key.remoteJid ?? "unknown",
    text,
    timestamp: timestampToIso(whatsappMessage.messageTimestamp)
  };
}

export async function requestPairingCodeWithRetry(
  socket: PairingSocket,
  phoneNumber: string,
  options: PairingRetryOptions = {}
): Promise<string> {
  const retries = options.retries ?? 5;
  const delayMs = options.delayMs ?? 1500;
  const normalizedPhoneNumber = normalizePhoneNumberForPairing(phoneNumber);
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await socket.requestPairingCode(normalizedPhoneNumber);
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }
      await delay(delayMs);
    }
  }

  throw lastError;
}

function extractText(message: WAMessage): string | undefined {
  const content = unwrapMessageContent(message.message);
  const text = content?.conversation
    ?? content?.extendedTextMessage?.text
    ?? content?.imageMessage?.caption
    ?? content?.videoMessage?.caption
    ?? content?.documentMessage?.caption
    ?? content?.buttonsMessage?.contentText
    ?? content?.templateMessage?.hydratedTemplate?.hydratedContentText
    ?? content?.listMessage?.description;
  return typeof text === "string" && text.trim() !== "" ? text : undefined;
}

function unwrapMessageContent(content: WAMessage["message"]): WAMessage["message"] {
  let current = content;
  for (let depth = 0; depth < 5; depth += 1) {
    const record = current as Record<string, { message?: WAMessage["message"] } | undefined> | undefined;
    const wrapped = record?.ephemeralMessage?.message
      ?? record?.viewOnceMessage?.message
      ?? record?.viewOnceMessageV2?.message
      ?? record?.documentWithCaptionMessage?.message
      ?? record?.editedMessage?.message
      ?? record?.deviceSentMessage?.message;
    if (!wrapped) {
      return current;
    }
    current = wrapped;
  }
  return current;
}

function normalizePhoneNumberForPairing(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, "");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timestampToIso(timestamp: WAMessage["messageTimestamp"]): string {
  if (typeof timestamp === "number") {
    return new Date(timestamp * 1000).toISOString();
  }
  if (timestamp && typeof timestamp === "object" && "toNumber" in timestamp && typeof timestamp.toNumber === "function") {
    return new Date(timestamp.toNumber() * 1000).toISOString();
  }
  return new Date().toISOString();
}
