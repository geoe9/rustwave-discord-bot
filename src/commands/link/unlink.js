const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { checkIsDiscordLinked, sendCommand } = require('../../link-manager.js')

const data = new SlashCommandBuilder()
	.setName('unlink')
	.setDescription('Unlink your Steam account')
    .setContexts(InteractionContextType.Guild)

const execute = async (interaction) => {
	await interaction.deferReply({ ephemeral: true });
	let isLinked = await checkIsDiscordLinked(interaction.user.id);
    if (isLinked) {
        sendCommand(`discordLink_unlinkPlayer ${isLinked.steam_id}`);
        await interaction.editReply({ content: `Unlink requested`, ephemeral: true })
    } else {
        await interaction.editReply({ content: `No link found`, ephemeral: true })
    }
}

module.exports = { data, execute };