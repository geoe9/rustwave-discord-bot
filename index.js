const { Client, Events, GatewayIntentBits } = require('discord.js');
const config = require('./config.json');
const inviteManager = require('./src/inviteManager.js')
//const userManager = require('./src/userManager.js')

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildInvites, GatewayIntentBits.GuildMembers] });

client.once(Events.ClientReady, async readyClient => {
	console.log(`Successfully logged in to Discord as ${readyClient.user.tag}`);
    const guild = await client.guilds.fetch(config.discord.serverid);
    inviteManager.updateInviteTable(guild)
});

client.on(Events.GuildMemberAdd, async member => {
    const guild = await client.guilds.fetch(config.discord.serverid);
    inviteManager.processNewMember(guild, member);    
});

client.on(Events.InviteCreate, async invite => {
    inviteManager.processNewInvite(invite)
});

client.login(config.discord.token);