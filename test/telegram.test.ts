import { describe, expect, it, vi } from "vitest";
import { TELEGRAM_COMMANDS, handleAdminCommand } from "../src/telegram.js";

const baseContext = {
  userId: 111,
  text: "/addwa sim_openai_01"
};

describe("handleAdminCommand", () => {
  it("rejects unauthorized users", async () => {
    const reply = vi.fn();
    const result = await handleAdminCommand({
      ...baseContext,
      userId: 999,
      allowedUserIds: new Set([111]),
      reply,
      sendPhoto: vi.fn(),
      evolution: fakeEvolution(),
      store: fakeStore()
    });

    expect(result).toBe(true);
    expect(reply).toHaveBeenCalledWith("Unauthorized");
  });

  it("creates an instance and sends QR for /addwa", async () => {
    const reply = vi.fn();
    const sendPhoto = vi.fn();
    const store = fakeStore();

    await handleAdminCommand({
      ...baseContext,
      allowedUserIds: new Set([111]),
      reply,
      sendPhoto,
      evolution: fakeEvolution(),
      store
    });

    expect(sendPhoto).toHaveBeenCalledWith("data:image/png;base64,abc", expect.stringContaining("sim_openai_01"));
    expect(store.items).toHaveLength(1);
  });

  it("stores phone number passed to /addwa", async () => {
    const store = fakeStore();

    await handleAdminCommand({
      ...baseContext,
      text: "/addwa sim_openai_01 +84901234567",
      allowedUserIds: new Set([111]),
      reply: vi.fn(),
      sendPhoto: vi.fn(),
      evolution: fakeEvolution(),
      store
    });

    expect(store.items[0]).toMatchObject({ phoneNumber: "+84901234567" });
  });

  it("shows help text for /help", async () => {
    const reply = vi.fn();

    await handleAdminCommand({
      ...baseContext,
      text: "/help",
      allowedUserIds: new Set([111]),
      reply,
      sendPhoto: vi.fn(),
      evolution: fakeEvolution(),
      store: fakeStore()
    });

    expect(reply).toHaveBeenCalledWith(expect.stringContaining("/addwa <alias>"));
  });
});

describe("TELEGRAM_COMMANDS", () => {
  it("defines slash menu commands without leading slash", () => {
    expect(TELEGRAM_COMMANDS.map((command) => command.command)).toEqual(["addwa", "qr", "listwa", "delwa", "help"]);
  });
});

function fakeEvolution() {
  return {
    createInstance: vi.fn().mockResolvedValue({ qrBase64: "data:image/png;base64,abc" }),
    connectInstance: vi.fn().mockResolvedValue({ qrBase64: "data:image/png;base64,abc" }),
    deleteInstance: vi.fn().mockResolvedValue(undefined)
  };
}

function fakeStore() {
  const items: unknown[] = [];
  return {
    items,
    get: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue(items),
    upsert: vi.fn(async (item: unknown) => { items.push(item); }),
    delete: vi.fn()
  };
}
