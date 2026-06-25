import { extractOtp } from "./otp.js";
import type { TelegramOtpMessage } from "./types.js";

type ForwardingMessageInput = {
  alias: string;
  phoneNumber?: string;
  from: string;
  text: string;
};

export function buildTelegramOtpMessage(
  message: ForwardingMessageInput,
  forwardRawMessagesWithoutOtp: boolean
): TelegramOtpMessage | undefined {
  const otp = extractOtp(message.text);
  if (!otp && !forwardRawMessagesWithoutOtp) {
    return undefined;
  }

  return {
    otp,
    alias: message.alias,
    phoneNumber: message.phoneNumber,
    from: message.from,
    text: message.text
  };
}
