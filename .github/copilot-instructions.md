# Copilot instructions

## Build, run, and validate

- Install dependencies with `pnpm install` (the repository declares `pnpm@10.32.1`), or `npm install` when working in the Docker-oriented npm workflow.
- Start the bot with `node index.js`. There is currently no `start` script in `package.json`; the README's `npm start` command is stale.
- Register the guild slash command with `node deploy-commands.js`. This requires `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID`.
- The only npm test script is a placeholder that exits with an error, and no test runner or lint script is configured. There is therefore no supported full-suite or single-test command yet.
- Build the container with `docker build --file Dockerfile --tag boyalone99-lfg-discord-bot .`. The image runs `node index.js`.

## Architecture

- `index.js` is the runtime entry point. It creates one Discord.js client, an optional MySQL connection, and a Fastify HTTP server.
- Discord interaction flow: `postLfgEmbed()` maintains the persistent LFG message; button custom IDs route through `interactionCreate`; game buttons open a modal; modal submission creates a temporary guild voice channel, optionally records it in MySQL, announces it in the LFG text channel, and moves the requester into the room.
- Temporary-room state is held in `tempVoiceChannels`, `activeLfgRooms`, and `voiceRoomAnnouncementMessages`. `voiceStateUpdate` deletes empty temporary rooms and their announcements. `ready` restores rooms still marked active in MySQL.
- The Fastify endpoint `GET /stream/lfg` renders the HTML overlay. It accepts repeated or single `players` query values as JSON, otherwise resolves active rooms from MySQL or in-memory state.
- `deploy-commands.js` is a separate one-shot Discord REST script for registering the `/lfg` command. Keep its command definition in sync with any interaction behavior added to `index.js`.

## Repository-specific conventions

- Use CommonJS (`require`/`module` style), plain JavaScript, and the existing Discord.js v14 builders and enums. Do not introduce an ESM or TypeScript conversion for a localized change.
- Load configuration with `dotenv` at process startup. Runtime settings are environment variables, with fallback Discord IDs and port values currently defined near the top of `index.js`; update `example.env` and the README when adding or renaming variables.
- Optional MySQL is enabled only when `DB_HOST`, `DB_NAME`, and `DB_USER` are all present. Database access goes through `queryDb()` and uses `?` placeholders; preserve the no-database fallback behavior.
- Discord API failures are generally handled at the operation boundary with `.catch(...)`, while startup and retry failures are logged with `console.error`. Preserve the retry behavior for required channel/message operations rather than reporting success early.
- Interaction routing depends on the `lfg-*` custom ID prefixes (`lfg-create-vc:`, `lfg-vc-modal:`, `lfg-add-role`, and `lfg-remove-role`). Preserve these IDs when changing buttons or modals.
- Temporary voice-channel lifecycle must update both in-memory maps/sets and the `voice_chats` MySQL row when persistence is configured. Channel deletion can be initiated by either the empty-room handler or Discord's `channelDelete` event.
- The bot's user-facing strings include Thai text and Discord markup. Preserve existing language and explicit `allowedMentions` settings when editing messages; do not broaden mentions accidentally.
- Keep the LFG stream route available on `0.0.0.0` and use `LFG_STREAM_PORT` for its port. The default action webhook is a local network endpoint controlled by `LFG_ACTION_WEBHOOK_URL`.
- The Dockerfile installs production dependencies with npm and copies the whole repository after installing dependencies. Avoid changing dependency manifests without considering both the pnpm lockfile and Docker's npm install path.
