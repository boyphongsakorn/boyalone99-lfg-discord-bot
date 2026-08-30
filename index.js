require('dotenv').config();
const fastify = require('fastify')({ logger: false });
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
});

const LFG_CHANNEL_ID = process.env.LFG_POST_CHANNEL_ID || '1543200807334322176';
const LFG_ROLE_ID = process.env.LFG_ROLE_ID || '1543368029063217193';
const LFG_STREAM_PORT = Number(process.env.LFG_STREAM_PORT || 3000);
const tempVoiceChannels = new Set();
const voiceRoomAnnouncementMessages = new Map();
const activeLfgRooms = new Map();

function getLiveLfgPlayers() {
  return Array.from(activeLfgRooms.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((room) => ({
      name: room.creator,
      game: room.game,
      note: room.description || 'No description',
      status: 'มองหาคนเล่นด้วย',
    }));
}

function renderLfgStreamHtml(players = getLiveLfgPlayers()) {
  const cards = players
    .map(
      (player) => `
        <div class="player-box">
          <div class="game-tag">${player.game}</div>
          <div class="player-header">
            <span class="name">${player.name}</span>
            <span class="status">${player.status}</span>
          </div>
          <div class="note">${player.note}</div>
        </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LFG Stream Overlay</title>
    <style>
      :root {
        --bg: rgba(15, 16, 26, 0.78);
        --panel: rgba(29, 33, 54, 0.9);
        --border: rgba(124, 140, 255, 0.9);
        --accent: #7dd3fc;
        --accent-2: #c084fc;
        --text: #eef2ff;
        --muted: #cbd5e1;
        --success: #4ade80;
      }

      * { box-sizing: border-box; }

      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        font-family: Arial, Helvetica, sans-serif;
      }

      body {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        overflow: hidden;
      }

      .stream-frame {
        width: 1920px;
        height: 300px;
        background: linear-gradient(135deg, rgba(17, 24, 39, 0.88), rgba(30, 41, 59, 0.9));
        border: 2px solid rgba(255,255,255,0.08);
        border-radius: 18px;
        box-shadow: 0 20px 50px rgba(15, 23, 42, 0.35);
        padding: 18px 20px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      .title {
        margin: 0 0 12px 0;
        font-size: 30px;
        font-weight: 700;
        letter-spacing: 1px;
        color: var(--text);
        text-transform: uppercase;
      }

      .row {
        display: flex;
        gap: 18px;
        align-items: stretch;
        justify-content: flex-start;
        flex-wrap: nowrap;
        overflow: hidden;
      }

      .player-box {
        min-width: 300px;
        max-width: 340px;
        flex: 1 1 0;
        background: var(--panel);
        border: 2px solid var(--border);
        border-radius: 14px;
        padding: 12px 14px;
        box-shadow: inset 0 0 0 1px rgba(165,180,252,0.28);
      }

      .game-tag {
        display: inline-block;
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        color: #0f172a;
        font-weight: 800;
        font-size: 18px;
        padding: 6px 10px;
        border-radius: 999px;
        margin-bottom: 10px;
      }

      .player-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
        min-width: 0;
      }

      .name {
        flex: 1 1 auto;
        min-width: 0;
        font-size: 28px;
        font-weight: 700;
        color: var(--text);
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      .status {
        flex-shrink: 0;
        font-size: 13px;
        font-weight: 700;
        color: var(--success);
        background: rgba(74, 222, 128, 0.1);
        border: 1px solid rgba(74, 222, 128, 0.35);
        border-radius: 999px;
        padding: 4px 8px;
        white-space: nowrap;
      }

      .note {
        font-size: 18px;
        color: var(--muted);
        line-height: 1.4;
        word-wrap: break-word;
      }
    </style>
  </head>
  <body>
    <div class="stream-frame">
      <h1 class="title">ผู้คนกำลังมองหาทีม (เข้าร่วม !discord)</h1>
      <div class="row">
        ${cards}
      </div>
    </div>
  </body>
</html>`;
}

fastify.get('/stream/lfg', async (request, reply) => {
  const rawPlayers = request.query.players;
  const players = Array.isArray(rawPlayers)
    ? rawPlayers.map((player) => JSON.parse(player))
    : rawPlayers
      ? [JSON.parse(rawPlayers)]
      : getLiveLfgPlayers();

  reply.type('text/html');
  return renderLfgStreamHtml(players);
});

fastify.listen({ port: LFG_STREAM_PORT, host: '0.0.0.0' })
  .then(() => {
    console.log(`LFG stream overlay is running at http://localhost:${LFG_STREAM_PORT}/stream/lfg`);
  })
  .catch((error) => {
    console.error('Failed to start LFG stream overlay server:', error);
  });

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  postLfgEmbed();
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isModalSubmit() && interaction.customId.startsWith('lfg-vc-modal:')) {
      await handleCreateVoiceModalSubmit(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('lfg-create-vc:')) {
      await handleCreateVoiceButton(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId === 'lfg-add-role') {
      await handleRoleButton(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId === 'lfg-remove-role') {
      await handleRemoveRole(interaction);
      return;
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    const reply = { content: 'Something went wrong. Please try again.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  }
});

async function deleteOldLfgEmbeds(channel) {
  if (!channel || channel.type !== ChannelType.GuildText) return;

  const messages = await channel.messages.fetch({ limit: 25 }).catch(() => new Map());
  const oldMessages = messages.filter((message) => {
    if (message.author.id !== client.user.id) return false;

    const hasLfgEmbed = message.embeds.some((embed) => embed.title === 'หาเพื่อนเล่นเกม (LFG)');
    const hasLfgButtons = message.components.some((row) =>
      row.components.some(
        (component) =>
          component.customId === 'lfg-create-vc:Warframe' ||
          component.customId === 'lfg-create-vc:Fortnite' ||
          component.customId === 'lfg-add-role' ||
          component.customId === 'lfg-remove-role'
      )
    );

    return hasLfgEmbed || hasLfgButtons;
  });

  await Promise.all(oldMessages.map((message) => message.delete().catch(() => {})));
}

async function postLfgEmbed() {
  const channel = await client.channels.fetch(LFG_CHANNEL_ID).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    console.error(`Could not find text channel ${LFG_CHANNEL_ID}.`);
    return;
  }

  await deleteOldLfgEmbeds(channel);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('หาเพื่อนเล่นเกม (LFG)')
    // .setDescription('Choose a game below to create a voice room or grab the LFG role for updates.')
    .setDescription('กดปุ่มด้านล่างเพื่อสร้างห้องเสียงสำหรับเกมที่คุณต้องการเล่น หรือรับ Role LFG เพื่อรับการแจ้งเตือนเมื่อเวลามีคนหาเพื่อนเล่นด้วย')
    .setTimestamp();

  const warframeButton = new ButtonBuilder()
    .setCustomId('lfg-create-vc:Warframe')
    .setLabel('Warframe')
    .setEmoji('⚔️')
    .setStyle(ButtonStyle.Primary);

  const fortniteButton = new ButtonBuilder()
    .setCustomId('lfg-create-vc:Fortnite')
    .setLabel('Fortnite')
    .setEmoji('🎮')
    .setStyle(ButtonStyle.Success);

  const roleButton = new ButtonBuilder()
    .setCustomId('lfg-add-role')
    .setLabel('รับ Role LFG')
    .setEmoji('🔔')
    .setStyle(ButtonStyle.Secondary);

  const removeRoleButton = new ButtonBuilder()
    .setCustomId('lfg-remove-role')
    .setLabel('ยกเลิก Role LFG')
    .setEmoji('🔕')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(
    warframeButton,
    fortniteButton,
    roleButton,
    removeRoleButton
  );

  await channel.send({
    embeds: [embed],
    components: [row],
    allowedMentions: { roles: [LFG_ROLE_ID] },
  });
}

async function handleRoleButton(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ content: 'This button can only be used in a server.' });
    return;
  }

  const role = await interaction.guild.roles.fetch(LFG_ROLE_ID).catch(() => null);
  if (!role) {
    await interaction.editReply({ content: 'The LFG role could not be found.' });
    return;
  }

  if (interaction.member.roles.cache.has(LFG_ROLE_ID)) {
    await interaction.editReply({ content: `You already have the <@&${role.id}> role.` });
    return;
  }

  await interaction.member.roles.add(role).catch(() => null);
  await interaction.editReply({ content: `ตอนนี้คุณมี ยศ(Role) <@&${role.id}> แล้ว จะได้รับ Ping เมื่อมีการสร้างห้องเสียงใหม่` });
}

async function handleRemoveRole(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ content: 'This button can only be used in a server.' });
    return;
  }

  const role = await interaction.guild.roles.fetch(LFG_ROLE_ID).catch(() => null);
  if (!role) {
    await interaction.editReply({ content: 'The LFG role could not be found.' });
    return;
  }

  if (!interaction.member.roles.cache.has(LFG_ROLE_ID)) {
    await interaction.editReply({ content: `คุณยังไม่มี ยศ(Role) <@&${role.id}>` });
    return;
  }

  await interaction.member.roles.remove(role).catch(() => null);
  await interaction.editReply({ content: `ยกเลิก ยศ(Role) <@&${role.id}> เรียบร้อยแล้ว` });
}


async function handleCreateVoiceButton(interaction) {
  // Show a modal to collect an optional description for the voice chat
  const [, gameName = 'Game'] = interaction.customId.split(':');

  const modal = new ModalBuilder()
    .setCustomId(`lfg-vc-modal:${gameName}`)
    .setTitle(`สร้างห้องเสียง ${gameName}`)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('vc_description')
          .setLabel('วัตถุประสงค์ของการสร้างห้องเสียงนี้')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('ไม่จำเป็นต้องกรอก แต่คุณสามารถใส่คำอธิบายเพื่อให้คนอื่นเข้าใจว่าห้องเสียงนี้เกี่ยวกับอะไร')
          .setRequired(false)
      )
    );

  await interaction.showModal(modal);
}

async function getLfgMentionPayload(guild) {
  if (!guild) {
    return {
      content: '@everyone',
      allowedMentions: { parse: ['everyone'] },
    };
  }

  const role = await guild.roles.fetch(LFG_ROLE_ID).catch(() => null);
  if (role && role.members.size > 0) {
    return {
      content: `<@&${LFG_ROLE_ID}>`,
      allowedMentions: { roles: [LFG_ROLE_ID] },
    };
  }

  return {
    content: '@everyone',
    allowedMentions: { parse: ['everyone'] },
  };
}

async function handleCreateVoiceModalSubmit(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  const member = interaction.member;
  const [, gameName = 'Game'] = interaction.customId.split(':');
  const description = interaction.fields.getTextInputValue('vc_description') || '';

  const categoryId = process.env.VOICE_CATEGORY_ID || '1543002292033421312';
  const category = categoryId ? await guild.channels.fetch(categoryId).catch(() => null) : null;
  const displayName = member.displayName || interaction.user.username;
  const channelName = `🎮 ${gameName} - ${displayName}`.slice(0, 100);

  const voiceChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildVoice,
    parent: category?.id ?? undefined,
    permissionOverwrites: category ? undefined : [
      {
        id: guild.roles.everyone,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
      },
    ],
  });

  tempVoiceChannels.add(voiceChannel.id);
  activeLfgRooms.set(voiceChannel.id, {
    id: voiceChannel.id,
    game: gameName,
    creator: displayName,
    description: description || 'No description',
    createdAt: Date.now(),
  });

  if (member.voice.channel) {
    await member.voice.setChannel(voiceChannel).catch(() => {});
  }

  // Post an embed in the LFG channel with the description
  const lfgChannel = await client.channels.fetch(LFG_CHANNEL_ID).catch(() => null);
  if (lfgChannel && lfgChannel.type === ChannelType.GuildText) {
    const embed = new EmbedBuilder()
      .setTitle(`สร้างห้องเสียง ${gameName} เรียบร้อยแล้ว`)
      .setDescription(description || 'ไม่มีคำอธิบาย')
      .addFields(
        { name: 'ชื่อห้องเสียง', value: `<#${voiceChannel.id}>`, inline: true },
        { name: 'สร้างโดย', value: `<@${interaction.user.id}>`, inline: true }
      )
      .setTimestamp();

    const mentionPayload = await getLfgMentionPayload(guild);

    const lfgMessage = await lfgChannel.send({
      content: mentionPayload.content,
      embeds: [embed],
      allowedMentions: mentionPayload.allowedMentions,
    }).catch(() => null);

    if (lfgMessage) {
      voiceRoomAnnouncementMessages.set(voiceChannel.id, lfgMessage.id);
    }
  }

  await interaction.editReply({
    content: `สร้าง <#${voiceChannel.id}> สำหรับ ${gameName} เรียบร้อยแล้ว. บันทึกคำอธิบายเรียบร้อยแล้ว: ${description || 'ไม่มีคำอธิบาย'}`,
  });
}

async function deleteVoiceRoomAnnouncement(channelId) {
  const messageId = voiceRoomAnnouncementMessages.get(channelId);
  if (!messageId) return;

  const lfgChannel = await client.channels.fetch(LFG_CHANNEL_ID).catch(() => null);
  if (lfgChannel && lfgChannel.type === ChannelType.GuildText) {
    await lfgChannel.messages.delete(messageId).catch(() => {});
  }

  voiceRoomAnnouncementMessages.delete(channelId);
}

client.on('voiceStateUpdate', async (oldState) => {
  const channel = oldState.channel;
  if (!channel) return;
  if (!tempVoiceChannels.has(channel.id)) return;

  if (channel.members.size === 0) {
    tempVoiceChannels.delete(channel.id);
    activeLfgRooms.delete(channel.id);
    await deleteVoiceRoomAnnouncement(channel.id);
    await channel.delete('LFG voice room empty').catch(() => {});
  }
});

client.on('channelDelete', async (channel) => {
  if (channel.type !== ChannelType.GuildVoice) return;
  if (!tempVoiceChannels.has(channel.id) && !voiceRoomAnnouncementMessages.has(channel.id)) return;

  tempVoiceChannels.delete(channel.id);
  activeLfgRooms.delete(channel.id);
  await deleteVoiceRoomAnnouncement(channel.id);
});

client.login(process.env.DISCORD_TOKEN);
