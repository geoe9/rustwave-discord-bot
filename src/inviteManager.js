const config = require('../config.json');
const { InviteTracker } = require('./db/databaseHandler.js')
const { EmbedBuilder, User } = require('discord.js')

let invites = {}

function updateInviteTable(guild) {
    guild.invites.fetch().then(guildInvites =>{
        guildInvites.each(guildInvite => {
            invites[guildInvite.code] = guildInvite.uses;
        });
        console.log(`[Invite Manager] Loaded ${Object.keys(invites).length} invites into memory`)
    });
}

function processNewInvite(invite) {
    invites[invite.code] = invite.uses
    console.log(`[Invite Manager] Loaded new invite '${invite.code}' into memory`)
}

async function processNewMember(guild, member) {
    const logChannel = await guild.channels.fetch(config.discord.joinLogChannelId);
    let invite = null;
    guild.invites.fetch().then(guildInvites => {
        guildInvites.each(guildInvite => {
            if(guildInvite.uses != invites[guildInvite.code] && guildInvite.inviter instanceof User) {
                invite = guildInvite.invite;
            }
        });
    });
    const welcomeEmbed = new EmbedBuilder()
        .setDescription(`Welcome **<@${member.user.id}>** to **Rustwave**! We hope you enjoy your stay. Check out <#${config.discord.rulesChannelId}> and <#${config.discord.annoucementsChannelId}> to get started.`)
        .setImage("https://i.imgur.com/fZ62BLc.png");
    if (invite.inviter instanceof User && !config.discord.excludeInvites.includes(invite.inviter.id)) {
        const user = await addRealInvite(invite.inviter);
        const inviteEmbed = new EmbedBuilder()
            .setDescription(`**<@${member.user.id}>** was invited by **<@${user.id}>** who now has **${user.getTotalInvites()}** total invites! Only **${Math.max(0, config.discord.inviteRewardAmount - user.getTotalInvites())}** more to go before they recieve 1 month of VIP.`);
        logChannel.send({ embeds: [welcomeEmbed, inviteEmbed] });
    } else {
        logChannel.send({ embeds: [welcomeEmbed] });
    }
    invites[invite.code] = invite.uses;
}

async function addRealInvite(inviter) {
    const users = InviteTracker.findAll();
    users.each(async user => {
        if (user.dataValues.id == inviter.id) {
            await user.increment({
                realInvites: 1
            });
            return user;
        }
    });
    return InviteTracker.create({
        id: inviter.id,
        name: inviter.username,
        realInvites: 1,
        fakeInvites: 0
    })
}

function addFakeInvite(user) {
    const users = InviteTracker.findAll();
    users.each(async user => {
        if (user.dataValues.id == user.id) {
            await user.increment({
                fakeInvites: 1
            });
            return;
        }
    });
    InviteTracker.create({
        id: user.id,
        name: user.username,
        realInvites: 0,
        fakeInvites: 1
    })
}

module.exports = { updateInviteTable, processNewMember, processNewInvite, addFakeInvite }