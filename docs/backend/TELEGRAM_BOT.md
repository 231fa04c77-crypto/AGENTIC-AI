# MEDCLUES Smart Patient Assistant — @medcluesBot

Corporate Telegram bot matching the MEDCLUES patient assistant design: welcome menus, inline buttons, real-time booking/report alerts.

## Start

```bash
cd fastapi_back
python main.py
```

Console: `[Telegram] Bot started: @medcluesBot`

## Link account (recommended)

1. MEDCLUES app → **Settings → Connect Telegram**
2. Tap **Connect** — Telegram opens
3. Press **START** — account links securely (no password in chat)

## Patient experience

| Screen | Trigger |
|--------|---------|
| Welcome + menu | `/start` (linked or unlinked) |
| Account linked | After app link code |
| Appointment booked | Auto on booking |
| Report available | Auto on health record upload |
| Health check-in | After link + `/checkin` |
| Appointment reminder | `notify_appointment_reminder()` (scheduler) |

## Inline buttons

- 📅 Book Appointment / Find Doctor → app links
- 📂 My Records / Upcoming → bot replies
- 🏠 Go to Dashboard → app
- 📄 View Appointment / 🗺 Directions → callback or maps
- 😊 Feeling Better / 😟 Need Assistance → check-in replies

## Commands (BotFather menu)

| Command | Description |
|---------|-------------|
| `/start` | Welcome & main menu |
| `/upcoming` | Next appointments |
| `/records` | Health records |
| `/profile` | Your profile |
| `/help` | Help & support |
| `/logout` | Unlink account |
| `/checkin` | Health check-in |

## Real-time notifications (backend hooks)

- `user_controller.book_appointment` → Telegram + email + FCM
- `user_controller.cancel_appointment` → Telegram + email + FCM
- `health_record_controller.create_health_record` → Telegram + email

## Environment

```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=medcluesBot
TELEGRAM_BOT_ENABLED=true   # Render only; false locally if Render polls
FRONTEND_URL=https://your-app-url   # used for inline button links
```

## One poller per token

Only **one** server may run `getUpdates`. Set `TELEGRAM_BOT_ENABLED=false` locally when Render is live.
