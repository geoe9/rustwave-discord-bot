const { SlashCommandBuilder, InteractionContextType, PermissionFlagsBits } = require('discord.js');

const data = new SlashCommandBuilder()
	.setName('invites')
	.setDescription('Add/remove a fake invite to a user')
	.addSubcommand(subcommand =>
		subcommand
			.setName('addfakeinvites')
			.setDescription('Add/remove fake invites from a user')
			.addUserOption(option => option.setName('target').setDescription('Target user'))
			.addIntegerOption(option => option.setName('amount').setDescription('Amount to add (supports negative values)')))
	.setContexts(InteractionContextType.Guild)
	.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

const execute = async (interaction) => {
	await interaction.deferReply({ ephemeral: true });
	const target = interaction.options.getUser('target');
	const amount = interaction.options.getInteger('amount');
	await interaction.client.inviteManager.addFakeInvite(target, amount)
	await interaction.editReply({ content: `Added ${amount} fake invites to <@${target.id}>`, ephemeral: true });
}

module.exports = { data, execute };