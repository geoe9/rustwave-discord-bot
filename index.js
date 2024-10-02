const { Client, Events, GatewayIntentBits } = require('discord.js');
const config = require('./config.json');
const inviteManager = require('./src/inviteManager.js')

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildInvites, GatewayIntentBits.GuildMembers] });

client.once(Events.ClientReady, readyClient => {
	console.log(`Successfully logged in to Discord as ${readyClient.user.tag}`);
    inviteManager(client)
});

client.login(config.discord.token);