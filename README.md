# WhatsApp OTP Telegram Hub

Self-hosted hub that links WhatsApp Web sessions with Baileys, extracts OTP codes from incoming messages, and forwards them to one Telegram chat. It also lets an authorized Telegram user add a new WhatsApp session and receive the QR code directly in Telegram.

## Safety Scope

Use this only with WhatsApp numbers you own or are authorized to manage. This project forwards incoming messages; it does not automate account creation, bypass verification systems, send spam, or evade service limits.

The hub uses WhatsApp Web sessions. Those sessions can disconnect or become invalid; keep the hub private, protect all tokens, and follow WhatsApp and service terms.

## Features

- Forward incoming WhatsApp OTP messages to one Telegram chat.
- Optionally forward raw messages when no OTP is detected.
- Add WhatsApp sessions from Telegram with `/addwa <alias>` or `/addwa <alias> <phoneNumber>`.
- Refresh QR with `/qr <alias>`.
- List sessions with `/listwa`.
- Delete sessions with `/delwa <alias>`.
- Register Telegram slash command suggestions automatically.
- Run locally or on a VPS with Docker Compose.

## Setup

1. Create a Telegram bot with BotFather.
2. Add the bot to your target Telegram group or channel.
3. Copy `.env.example` to `.env` and fill values.
4. Start the stack:

```bash
docker compose up --build
```

## Environment Variables

```dotenv
PORT=8787
HUB_STORAGE_PATH=./data/instances.json

TELEGRAM_BOT_TOKEN=replace-me
TELEGRAM_OTP_CHAT_ID=replace-me
TELEGRAM_ALLOWED_USER_IDS=123456789
FORWARD_RAW_MESSAGES_WITHOUT_OTP=false

# Optional: only used if posting Evolution-compatible webhooks to /webhook/evolution.
EVOLUTION_WEBHOOK_SECRET=replace-me
```

Set `FORWARD_RAW_MESSAGES_WITHOUT_OTP=true` if you want every non-OTP WhatsApp text forwarded as a raw Telegram message. Keep it `false` to reduce noise and forward only messages where an OTP is detected.

WhatsApp session files are stored under `./data/sessions` when using Docker Compose.

## Telegram Commands

```text
/addwa sim_openai_01
/addwa sim_openai_02 +84901234567
/qr sim_openai_01
/listwa
/delwa sim_openai_01
/help
```

## Development

```bash
npm install
npm test
npm run build
npm run dev
```

## License

MIT
