import { describe, expect, it } from "vitest";
import { buildTelegramOtpMessage } from "../src/forwarding.js";

const baseMessage = {
  alias: "sim_openai_01",
  phoneNumber: "+84901234567",
  from: "OpenAI",
  text: "Welcome to the service."
};

describe("buildTelegramOtpMessage", () => {
  it("forwards messages with detected OTP", () => {
    const result = buildTelegramOtpMessage({
      ...baseMessage,
      text: "Your verification code is 123456."
    }, false);

    expect(result).toMatchObject({ otp: "123456", text: "Your verification code is 123456." });
  });

  it("drops raw messages without OTP by default", () => {
    expect(buildTelegramOtpMessage(baseMessage, false)).toBeUndefined();
  });

  it("forwards raw messages without OTP when enabled", () => {
    expect(buildTelegramOtpMessage(baseMessage, true)).toMatchObject({
      otp: undefined,
      text: "Welcome to the service."
    });
  });
});
