import type { TelegramOtpMessage } from "./types.js";

const otpPatterns = [
  /(?:code|otp|verification|verify|mã|ma|xac minh|xác minh|xac thuc|xác thực)[^0-9]{0,40}(\d(?:[\s-]*\d){3,7})/i,
  /(?<!\d)(\d(?:[\s-]*\d){3,7})(?!\d)/
];

export function extractOtp(text: string): string | undefined {
  for (const pattern of otpPatterns) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }

    const code = match.slice(1).filter(Boolean).join("").replace(/\D/g, "");
    if (/^\d{4,8}$/.test(code) && !looksLikePhoneNumber(text, code)) {
      return code;
    }
  }

  return undefined;
}

function looksLikePhoneNumber(text: string, code: string): boolean {
  const compact = text.replace(/[\s().-]/g, "");
  return compact.includes(`+${code}`) || compact.includes(`84${code}`) || compact.includes(`0${code}`);
}

export function formatOtpMessage(message: TelegramOtpMessage): string {
  const header = message.otp ? `🔐 OTP: ${message.otp}` : "⚠️ No OTP detected";
  const wa = message.phoneNumber ? `${message.alias} (${message.phoneNumber})` : message.alias;

  return [
    header,
    `📱 WA: ${wa}`,
    `👤 From: ${message.from}`,
    `💬 Text: ${message.text}`
  ].join("\n");
}
