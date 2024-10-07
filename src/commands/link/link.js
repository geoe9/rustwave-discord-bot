const { SlashCommandBuilder, InteractionContextType } = require('discord.js');

const data = new SlashCommandBuilder()
	.setName('link')
	.setDescription('Link your steam account to Discord')
	.addStringOption(option => option.setName('code').setDescription("Your in-game link code").setRequired(true))
    .setContexts(InteractionContextType.Guild)

const execute = async (interaction) => {
	await interaction.deferReply({ ephemeral: true });
	await interaction.client.linkManager.checkLinkingCode(interaction.options.getString("code"), interaction).then(response => {
        interaction.editReply({ content: response, ephemeral: true });
    });
}

module.exports = { data, execute };