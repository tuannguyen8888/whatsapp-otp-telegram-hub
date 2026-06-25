import { describe, expect, it } from "vitest";
import { extractOtp, formatOtpMessage } from "../src/otp.js";

describe("extractOtp", () => {
  it("extracts a six digit verification code", () => {
    expect(extractOtp("Your verification code is 123456.")).toBe("123456");
  });

  it("extracts a code with a dash", () => {
    expect(extractOtp("Use 123-456 to sign in.")).toBe("123456");
  });

  it("extracts a code split into uneven digit groups", () => {
    expect(extractOtp("Use 12-3456 to sign in.")).toBe("123456");
    expect(extractOtp("Use 1234 56 to sign in.")).toBe("123456");
  });

  it("extracts a code split into single digit groups", () => {
    expect(extractOtp("Your OTP is 1 2 3 4 5 6.")).toBe("123456");
  });

  it("does not treat long phone numbers as OTP", () => {
    expect(extractOtp("Call +84901234567 if this was not you.")).toBeUndefined();
  });

  it("returns undefined when no OTP exists", () => {
    expect(extractOtp("Welcome to the service.")).toBeUndefined();
  });
});

describe("formatOtpMessage", () => {
  it("formats detected OTP messages", () => {
    expect(formatOtpMessage({
      otp: "123456",
      alias: "sim_openai_01",
      phoneNumber: "+84901234567",
      from: "OpenAI",
      text: "Your verification code is 123456."
    })).toContain("🔐 OTP: 123456");
  });

  it("labels messages without OTP", () => {
    expect(formatOtpMessage({
      alias: "sim_openai_01",
      from: "OpenAI",
      text: "Welcome."
    })).toContain("⚠️ No OTP detected");
  });
});
