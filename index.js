require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
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
const tempVoiceChannels = new Set();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  postLfgEmbed();
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isButton() && interaction.customId.startsWith('lfg-create-vc:')) {
      await handleCreateVoiceButton(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId === 'lfg-add-role') {
      await handleRoleButton(interaction);
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
          component.customId === 'lfg-add-role'
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
    .setDescription('กดปุ่มด้านล่างเพื่อสร้างห้องเสียงสำหรับเกมที่คุณต้องการเล่น หรือรับ Role LFG เพื่อรับการแจ้งเตือนหาเพื่อนเล่น')
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
    .setLabel('รับ Role LFG เพื่อรับการแจ้งเตือนหาเพื่อนเล่น')
    .setEmoji('🔔')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(warframeButton, fortniteButton, roleButton);

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
  await interaction.editReply({ content: `You now have the <@&${role.id}> role.` });
}

async function handleCreateVoiceButton(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  const member = interaction.member;
  const [, gameName = 'Game'] = interaction.customId.split(':');

  const categoryId = process.env.VOICE_CATEGORY_ID;
  const category = categoryId ? await guild.channels.fetch(categoryId).catch(() => null) : null;

  const channelName = `🎮 ${gameName} - ${interaction.user.username}`.slice(0, 100);

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

  if (member.voice.channel) {
    await member.voice.setChannel(voiceChannel).catch(() => {});
  }

  await interaction.editReply({
    content: `Created <#${voiceChannel.id}> for ${gameName}. Jump in and find a teammate!`,
  });
}

client.on('voiceStateUpdate', async (oldState) => {
  const channel = oldState.channel;
  if (!channel) return;
  if (!tempVoiceChannels.has(channel.id)) return;

  if (channel.members.size === 0) {
    tempVoiceChannels.delete(channel.id);
    await channel.delete('LFG voice room empty').catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN);
