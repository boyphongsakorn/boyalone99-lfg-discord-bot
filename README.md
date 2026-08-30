# Discord LFG Bot

A Node.js Discord bot for a "Looking For Group" workflow:

1. Someone runs `/lfg game:"Valorant" note:"need 2 more, gold+"` in your LFG channel.
2. The bot posts an embed with a **Create Voice Room** button and pings your `@lfg` role.
3. Anyone can click the button — it creates a temporary voice channel and drops the clicker straight into it.
4. The voice channel is automatically deleted once everyone leaves.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Create a Discord application
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. Go to **Bot** → **Add Bot**, then copy the token.
3. Under **Bot**, enable the **Server Members Intent** if you plan to expand the bot later (not required for the core flow).
4. Under **OAuth2 → URL Generator**, select scopes `bot` and `applications.commands`, and permissions:
   - Manage Channels
   - Move Members
   - Connect
   - View Channels
   - Send Messages
   - Embed Links
5. Use the generated URL to invite the bot to your server.

### 3. Configure environment variables
Copy `.env.example` to `.env` and fill in the values:
```bash
cp .env.example .env
```

- `DISCORD_TOKEN` — your bot token
- `CLIENT_ID` — your application's client ID
- `GUILD_ID` — your server ID
- `LFG_ROLE_ID` — the role to ping (create an `@lfg` role people can opt into)
- `LFG_CHANNEL_ID` — (optional) restrict `/lfg` to one channel
- `VOICE_CATEGORY_ID` — the category where temp voice channels should be created

Enable Developer Mode in Discord (User Settings → Advanced) to copy IDs by right-clicking.

### 4. Register the slash command
```bash
npm run deploy
```

### 5. Start the bot
```bash
npm start
```

## How people use it

- Members react to LFG posts by pinging into the `@lfg` role or by running `/lfg`.
- Anyone can subscribe to the `@lfg` role via a reaction role or Server Settings → self-assignable roles, so only interested people get pinged.
- Voice rooms clean themselves up — no manual moderation needed.

## Customizing
- **Channel naming**: edit `channelName` in `src/index.js`.
- **Auto-delete timing**: currently instant once empty; add a `setTimeout` in the `voiceStateUpdate` handler if you'd rather wait a minute before deleting.
- **Permissions on temp channels**: adjust `permissionOverwrites` in `handleCreateVoiceButton`.
