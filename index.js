const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');
const config = require('./config.json');
const { InviteManager } = require('./src/invite-manager.js');
const registerCommands = require('./src/register-commands.js');
const { LinkManager } = require('./src/link-manager.js');
const { RconConnectionCollection } = require('./src/rcon.js');

const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildModeration
]});

client.commands = new Collection()

client.rcons = new RconConnectionCollection(client, config.servers);
client.linkManager = new LinkManager(client);
client.inviteManager = new InviteManager(client);

client.once(Events.ClientReady, async readyClient => {
	console.log(`Successfully logged in to Discord as ${readyClient.user.tag}`);
    const guild = await client.guilds.fetch(config.discord.guildId);
    registerCommands(client);
    client.inviteManager.updateInviteTable();
    client.rcons.connect();
    client.linkManager.setActivity(client);
});

client.on(Events.GuildMemberAdd, async member => {
    client.inviteManager.processNewMember(member); 
});

client.on(Events.InviteCreate, async invite => {
    client.inviteManager.processNewInvite(invite)
});

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;
	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	}
});

client.on(Events.MessageCreate, async message => {
    if(config.link.linkChannelId === message.channel.id && !message.author.bot) {
        message.delete();
        return;
    }
});

client.on(Events.GuildMemberRemove, async member => {
    const isLinked = await client.linkManager.checkIsDiscordLinked(member.id);
    if (isLinked) client.rcons.sendCommand(`discordLink_unlinkPlayer ${isLinked.steam_id}`);
});

client.on(Events.GuildMemberUpdate, (oldStatus, newStatus) => {
    client.linkManager.memberUpdate(oldStatus, newStatus);
});

client.login(config.discord.token);