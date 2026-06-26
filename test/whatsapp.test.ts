import { describe, expect, it } from "vitest";
import { describeBaileysMessageForLog, normalizeBaileysMessage, requestPairingCodeWithRetry } from "../src/whatsapp.js";

describe("normalizeBaileysMessage", () => {
  it("normalizes inbound text messages", () => {
    const result = normalizeBaileysMessage("sim_openai_01", {
      key: { fromMe: false, remoteJid: "12345@s.whatsapp.net" },
      message: { conversation: "Your code is 123456" },
      messageTimestamp: 1782219600
    });

    expect(result).toEqual({
      alias: "sim_openai_01",
      instanceName: "sim_openai_01",
      from: "12345@s.whatsapp.net",
      text: "Your code is 123456",
      timestamp: "2026-06-23T13:00:00.000Z"
    });
  });

  it("ignores outgoing messages", () => {
    expect(normalizeBaileysMessage("sim_openai_01", {
      key: { fromMe: true },
      message: { conversation: "123456" }
    })).toBeUndefined();
  });

  it("normalizes text inside ephemeral message wrappers", () => {
    const result = normalizeBaileysMessage("sim_openai_01", {
      key: { fromMe: false, remoteJid: "12345@s.whatsapp.net" },
      message: {
        ephemeralMessage: {
          message: {
            extendedTextMessage: {
              text: "Your OTP is 123456."
            }
          }
        }
      },
      messageTimestamp: 1782219600
    });

    expect(result?.text).toBe("Your OTP is 123456.");
  });

  it("describes ignored messages without exposing text content", () => {
    const description = describeBaileysMessageForLog({
      key: { fromMe: false, remoteJid: "12345@s.whatsapp.net" },
      message: {
        extendedTextMessage: {
          text: "Your OTP is 123456."
        }
      }
    });

    expect(description).toContain("from=12345@s.whatsapp.net");
    expect(description).toContain("contentTypes=extendedTextMessage");
    expect(description).not.toContain("123456");
    expect(description).not.toContain("Your OTP");
  });
});

describe("requestPairingCodeWithRetry", () => {
  it("retries when Baileys closes before accepting the pairing request", async () => {
    let attempts = 0;
    const socket = {
      requestPairingCode: async (phoneNumber: string) => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("Connection Closed");
        }
        expect(phoneNumber).toBe("848498717507");
        return "12345678";
      }
    };

    await expect(requestPairingCodeWithRetry(socket, "+848498717507", { retries: 2, delayMs: 1 })).resolves.toBe("12345678");
    expect(attempts).toBe(2);
  });
});
