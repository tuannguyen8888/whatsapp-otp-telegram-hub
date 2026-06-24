import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WhatsAppInstance } from "../src/types.js";

type EventHandler = (payload: unknown) => Promise<void> | void;

let eventHandlers: Record<string, EventHandler[]>;

const fakeSocket = {
  ev: {
    on: vi.fn((event: string, handler: EventHandler) => {
      eventHandlers[event] ??= [];
      eventHandlers[event].push(handler);
    })
  },
  end: vi.fn(),
  logout: vi.fn()
};

vi.mock("baileys", () => ({
  default: vi.fn(() => fakeSocket),
  Browsers: {
    ubuntu: vi.fn(() => ["Ubuntu", "Chrome", "1.0"])
  },
  DisconnectReason: {
    loggedOut: 401
  },
  fetchLatestBaileysVersion: vi.fn(async () => ({ version: [1, 2, 3] })),
  useMultiFileAuthState: vi.fn(async () => ({
    state: { creds: {}, keys: {} },
    saveCreds: vi.fn()
  }))
}));

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn(async () => "data:image/png;base64,abc")
  }
}));

describe("WhatsAppClient QR delivery", () => {
  beforeEach(() => {
    eventHandlers = {};
    vi.clearAllMocks();
  });

  it("does not forward unsolicited QR updates during restore", async () => {
    const { WhatsAppClient } = await import("../src/whatsapp.js");
    const onQr = vi.fn();
    const client = new WhatsAppClient({
      sessionRoot: "/tmp/whatsapp-otp-telegram-hub-test",
      onQr
    });

    await client.restore([fakeInstance()]);
    await eventHandlers["connection.update"][0]?.({ qr: "restore-qr" });

    expect(onQr).not.toHaveBeenCalled();
  });

  it("returns the first QR to an explicit command waiter", async () => {
    const { WhatsAppClient } = await import("../src/whatsapp.js");
    const onQr = vi.fn();
    const client = new WhatsAppClient({
      sessionRoot: "/tmp/whatsapp-otp-telegram-hub-test",
      onQr
    });

    const qrPromise = client.createInstance("sim_openai_01");
    await vi.waitFor(() => expect(eventHandlers["connection.update"]).toHaveLength(1));
    await eventHandlers["connection.update"][0]?.({ qr: "command-qr" });

    await expect(qrPromise).resolves.toEqual({ qrBase64: "data:image/png;base64,abc" });
    expect(onQr).not.toHaveBeenCalled();
  });
});

function fakeInstance(): WhatsAppInstance {
  return {
    alias: "sim_openai_01",
    instanceName: "sim_openai_01",
    status: "pending_qr",
    createdAt: "2026-06-23T00:00:00.000Z",
    updatedAt: "2026-06-23T00:00:00.000Z"
  };
}
