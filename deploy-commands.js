require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('lfg')
    .setDescription('Post a "Looking for Group" request and let people spin up a voice room')
    .addStringOption(option =>
      option.setName('game')
        .setDescription('What game are you playing?')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('note')
        .setDescription('Extra details (rank, mode, how many players, etc.)')
        .setRequired(false))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Deploying ${commands.length} slash command(s)...`);

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );

    console.log('Slash commands deployed successfully.');
  } catch (error) {
    console.error('Failed to deploy commands:', error);
  }
})();
