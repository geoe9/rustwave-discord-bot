const config = require('../config.json');
const { InviteTracker } = require('./db/database-handler.js')
const { EmbedBuilder, User } = require('discord.js')

class InviteManager {
    
    #invites = {};
    #guild;

    constructor(client) {
        this.client = client;
    }

    async updateInviteTable() {
        this.#guild = await this.client.guilds.fetch(config.discord.guildId);
        this.#guild.invites.fetch().then(guildInvites =>{
            guildInvites.each(guildInvite => {
                this.#invites[guildInvite.code] = guildInvite.uses;
            });
            console.log(`[Invite Manager] Loaded ${Object.keys(this.#invites).length} invites into memory`)
        });
    }

    processNewInvite(invite) {
        this.#invites[invite.code] = invite.uses
        console.log(`[Invite Manager] Loaded new invite '${invite.code}' into memory`)
    }

    async processNewMember(member) {
        const welcomeChannel = await this.#guild.channels.fetch(config.discord.welcomeChannelId);
        let invite = null;
        const guildInvites = await this.#guild.invites.fetch();
        guildInvites.each(guildInvite => {
            if(guildInvite.uses != this.#invites[guildInvite.code] && guildInvite.inviter instanceof User) {
                invite = guildInvite.invite;
            }
        });
        const welcomeEmbed = new EmbedBuilder()
            .setColor("#0B82AE")
            .setDescription(`Welcome **<@${member.user.id}>** to **Rustwave**! We hope you enjoy your stay. Check out <#${config.discord.rulesChannelId}> and <#${config.discord.annoucementsChannelId}> to get started.`)
            .setImage("https://i.imgur.com/fZ62BLc.png");
        if (invite && !config.invites.excludeInviteUsers.includes(invite.inviter.id) && !config.invites.excludeInviteCodes.includes(invite.code)) {
            const user = await addRealInvite(invite.inviter);
            const inviteEmbed = new EmbedBuilder()
                .setColor("#0B82AE")
                .setDescription(`**<@${member.user.id}>** was invited by **<@${user.id}>** who now has **${user.getTotalInvites()}** total invites! Only **${Math.max(0, config.invites.inviteRewardAmount - user.getTotalInvites())}** more to go before they recieve 1 month of VIP.`);
            welcomeChannel.send({ embeds: [welcomeEmbed, inviteEmbed] });
            this.#invites[invite.code] = invite.uses;
        } else {
            welcomeChannel.send({ embeds: [welcomeEmbed] });
        }
    }

    async addRealInvite(target) {
        const dbUser = await InviteTracker.findByPk(target.id);
        if (dbUser === null) {
            return await InviteTracker.create({
                id: target.id,
                name: target.username,
                realInvites: 1,
                fakeInvites: 0
            });
        } else {
            await dbUser.increment({
                realInvites: 1
            });
        }
    }

    async addFakeInvite(target, amount = 1) {
        const dbUser = await InviteTracker.findByPk(target.id);
        if (dbUser === null) {
            return await InviteTracker.create({
                id: target.id,
                name: target.username,
                realInvites: 0,
                fakeInvites: amount
            });
        } else {
            await dbUser.increment({
                fakeInvites: amount
            });
        }
    }
}

module.exports = { InviteManager }