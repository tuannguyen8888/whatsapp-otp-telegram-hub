import { describe, expect, it } from "vitest";
import { normalizeEvolutionMessage, normalizeEvolutionQrUpdate, verifyWebhookSecret } from "../src/webhook.js";

describe("verifyWebhookSecret", () => {
  it("accepts matching secret", () => {
    expect(verifyWebhookSecret("secret", "secret")).toBe(true);
  });

  it("rejects missing or wrong secret", () => {
    expect(verifyWebhookSecret(undefined, "secret")).toBe(false);
    expect(verifyWebhookSecret("wrong", "secret")).toBe(false);
  });
});

describe("normalizeEvolutionMessage", () => {
  it("normalizes inbound message payload", () => {
    const result = normalizeEvolutionMessage("sim_openai_01", {
      event: "MESSAGES_UPSERT",
      data: {
        key: { fromMe: false, remoteJid: "OpenAI" },
        message: { conversation: "Your code is 123456" },
        messageTimestamp: 1782219600
      }
    });

    expect(result).toEqual({
      alias: "sim_openai_01",
      instanceName: "sim_openai_01",
      from: "OpenAI",
      text: "Your code is 123456",
      timestamp: "2026-06-23T13:00:00.000Z"
    });
  });

  it("normalizes lowercase inbound message events from Evolution API", () => {
    const result = normalizeEvolutionMessage("sim_openai_01", {
      event: "messages.upsert",
      data: {
        key: { fromMe: false, remoteJid: "OpenAI" },
        message: { conversation: "Your code is 123456" },
        messageTimestamp: 1782219600
      }
    });

    expect(result?.text).toBe("Your code is 123456");
  });

  it("ignores outgoing messages", () => {
    expect(normalizeEvolutionMessage("sim_openai_01", {
      event: "MESSAGES_UPSERT",
      data: { key: { fromMe: true }, message: { conversation: "123456" } }
    })).toBeUndefined();
  });
});

describe("normalizeEvolutionQrUpdate", () => {
  it("normalizes QR webhook payloads", () => {
    const result = normalizeEvolutionQrUpdate("sim_openai_01", {
      event: "qrcode.updated",
      data: {
        qrcode: {
          instance: "sim_openai_01",
          base64: "data:image/png;base64,abc",
          pairingCode: "12345678"
        }
      }
    });

    expect(result).toEqual({
      alias: "sim_openai_01",
      instanceName: "sim_openai_01",
      qrBase64: "data:image/png;base64,abc",
      pairingCode: "12345678"
    });
  });
});
