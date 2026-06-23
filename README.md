# WhatsApp OTP Telegram Hub

Self-hosted hub that receives WhatsApp messages from Evolution API, extracts OTP codes, and forwards them to one Telegram chat. It also lets an authorized Telegram user add a new WhatsApp session and receive the QR code directly in Telegram.

## Safety Scope

Use this only with WhatsApp numbers you own or are authorized to manage. This project forwards incoming messages; it does not automate account creation, bypass verification systems, send spam, or evade service limits.

Evolution API uses WhatsApp web sessions. Those sessions can disconnect or become invalid; keep the hub private, protect all tokens, and follow WhatsApp and service terms.

## Features

- Forward incoming WhatsApp OTP messages to one Telegram chat.
- Add WhatsApp sessions from Telegram with `/addwa <alias>`.
- Refresh QR with `/qr <alias>`.
- List sessions with `/listwa`.
- Delete sessions with `/delwa <alias>`.
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
HUB_PUBLIC_URL=https://example.com
HUB_STORAGE_PATH=./data/instances.json

TELEGRAM_BOT_TOKEN=replace-me
TELEGRAM_OTP_CHAT_ID=replace-me
TELEGRAM_ALLOWED_USER_IDS=123456789

EVOLUTION_API_BASE_URL=http://evolution-api:8080
EVOLUTION_API_KEY=replace-me
EVOLUTION_WEBHOOK_SECRET=replace-me
```

`HUB_PUBLIC_URL` must be reachable by Evolution API. If everything runs inside the same Compose network and Evolution API can call the hub directly, set it to the internal URL that Evolution API can reach.

## Telegram Commands

```text
/addwa sim_openai_01
/qr sim_openai_01
/listwa
/delwa sim_openai_01
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
