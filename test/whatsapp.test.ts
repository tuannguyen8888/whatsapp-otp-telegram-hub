import { describe, expect, it } from "vitest";
import { normalizeBaileysMessage } from "../src/whatsapp.js";

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
});
