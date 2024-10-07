const config = require('../config.json');
const { LinkPlayerInfo, LinkSavedCodes } = require('./db/database-handler.js');
const { ActivityType, EmbedBuilder } = require('discord.js');

class LinkManager {

    constructor(client) {
        this.client = client;
        this.addingRoles = [];
        this.removingRoles = [];
        this.syncRoles = [];
        this.didSync = [];
    }

    recieveLinkCommand(content) {
        content = content.replace("\n", "");
        let action = content.slice(0, content.indexOf('||')).split(".")[1];
        let data = JSON.parse(content.slice(content.indexOf("||") + 2));
        switch(action) {
            case "Generated":
                this.addCodeToDatabase(data);
                break;
            case "Unlinked":
                this.unlinkPlayer(data.steamId);
                break;
            case "RoleChanged":
                this.roleChanged(data);
                break;
            case "CheckStatus":
                this.checkLinkStatus(data);
                break;
            case "VerifyUnlink":
                this.client.rcons.sendCommand(`discordLink_unlinkPlayer ${data.SteamID}`);
                break;
            case "RolesToSync":
                data.rolesToSync.forEach(role => { if(!this.syncRoles.includes(role)) this.syncRoles.push(role) });    
                if(!this.didSync) {
                    this.roleSync = null;
                    this.didSync = true;
                }                
                break;
        }
    }

    async checkLinkStatus(data) {
        const isLinked = await this.checkIsSteamLinked(data.steamId);
        if(!isLinked) return;
    
        const guild = client.guilds.cache.get(config.discord.guildId);
        const member = guild.members.cache.get(isLinked.discord_id);
        let lastUpdate = isLinked.lastUpdated;
        let steamData = { name: isLinked.name, profile_url: isLinked.profile_url, picture: isLinked.picture };
        let profilePicture;
    
        if(lastUpdate + 24 < Date.now()) {
            const steamInfo = await this.getSteamInfo(data.steamId);
            if(typeof steamInfo != "object") return;
            steamData = { name: steamInfo.personaname, profile_url: steamInfo.profileurl, picture: steamInfo.avatarfull };
            lastUpdate = `${Date.now() / 1000}`;
            if(lastUpdate.includes('.')) lastUpdate = lastUpdate.split(".")[0];
    
            LinkPlayerInfo.update(
                {
                    picture: steamData.picture,
                    name: steamData.personaname,
                    profile_url: steamData.profile_url,
                    lastUpdated: lastUpdate
                },
                {
                    where: {
                        steam_id: isLinked.steam_id,
                        isLinked: true
                    }
                }
            );
        }
        
        data.groups.forEach(role => {  
            if(!member.roles.cache.has(role.Value)) {
                var add = this.addingRoles.find(x => x.discordId == member.id);
                if(add != undefined) {
                    add.roles.push(role.Value);
                } else {
                    this.addingRoles.push({ discordId: member.id, roles: [role] });
                }
    
                member.roles.add(role.Value);
            }
        });
    
        this.syncRoles.forEach(role => {  
            if(member.roles.cache.has(role) && !data.groups.includes(x => x.Value))
                {
                    var remove = this.removingRoles.find(x => x.discordId == member.id);
                    if(remove != undefined) {
                        remove.roles.push(role.Value);
                    } else {
                        this.removingRoles.push({ discordId: member.id, roles: [role] });
                    }
    
                    member.roles.remove(role);
                }
         });
    
        if(member.avatar != null) profilePicture = `https://cdn.discordapp.com/guilds/${config.discord.guildId}/users/${member.id}/avatars/${member.avatar}.png`;
        else profilePicture = member.user.displayAvatarURL().split(".webp")[0] + ".png";
    
        this.client.rcons.sendCommand(`discordLink_updatePlayer ${isLinked.steam_id} ${isLinked.discord_id} true ${member.premiumSince != null} ${profilePicture} ${steamData.picture} ${member.displayName}`);
    }

    async roleChanged(data) {
        const isLinked = await this.checkIsDiscordLinked(data.discordId);
        if(!isLinked) return;
    
        const guild = this.client.guilds.cache.get(config.discord.guildId);
        const member = guild.members.cache.get(data.discordId);
    
        if(member == undefined || member == null) return;
        if(data.roleId.length < 10 || parseInt(data.roleId) == undefined) return;
    
        if(data.added) member.roles.add(data.roleId);
        else member.roles.remove(data.roleId);
    }

    updateDatabase(username, isBooster, discordId) {
        LinkPlayerInfo.update(
            { discord_name: username, isBooster: isBooster },
            { where: { discord_id: discordId } }
        );
    }

    async unlinkPlayer(steamId) {
        const isLinked = await this.checkIsSteamLinked(steamId);
    
        const guild = this.client.guilds.cache.get(config.discord.guildId);
        const member = guild.members.cache.get(isLinked.discord_id);
    
        if(member != undefined && member != null) {
            config.link.linkedRoles.forEach(role => {
                if(role.length > 10 && parseInt(role) != undefined) member.roles.remove(role);
            });
    
            this.syncRoles.forEach(role => {
                if(role.length > 10 && parseInt(role) != undefined) member.roles.remove(role);
            });
        }
    
        if(isLinked) {
            LinkPlayerInfo.update(
                { isLinked: false },
                { where: { steam_id: steamId } }
            )
            this.sendUnlinkEmbed(this.client, isLinked);
        }
    }

    async addCodeToDatabase(info) {
        const row = await LinkSavedCodes.findOne({ where: { userId: info.userId } })
        if (row) {
            await LinkSavedCodes.update(
                { code: info.code, displayName: info.displayName },
                { where: { userId: info.userId } }
            )
        } else {
            await LinkSavedCodes.create({
                userId: info.userId, displayName: info.displayName, code: info.code
            });
        }
    }

    async checkLinkingCode(code, interaction) {
        let isLinked = await this.checkIsDiscordLinked(interaction.user.id);
        if (isLinked) return `You are already linked to **[${isLinked.name}](${isLinked.profile_url})**`;
        const row = await LinkSavedCodes.findOne({ where: { code: code } });
        if (row === null) {
            return "The code that you provided is not valid or has expired";
        }
        return await this.linkUser(row.userId, interaction);
    }

    async linkUser(steamId, interaction) {
        let steamInfo = await this.getSteamInfo(steamId);
    
        if(typeof steamInfo != "object") {
            const embed = new EmbedBuilder()
                .setColor(config.DEFAULT_EMBED_COLOR)
                .setDescription(steamId);
            interaction.editReply({ embeds: [embed], ephemeral: true });
            return;
        }
    
        let profilePicture = interaction.user.displayAvatarURL();
        if(profilePicture.includes(".webp")) profilePicture.split(".")[0] + ".png";
        const guild = await this.client.guilds.fetch(config.discord.guildId);
        let member = await guild.members.fetch(interaction.user.id);
        let alreadyLinked = false;
        let time = (Date.now() / 1000).toString();
        if(time.includes('.')) time = time.split(".")[0];
    
        let doesBoost = member.premiumSince != null;
        if(member.avatar != null) profilePicture = `https://cdn.discordapp.com/guilds/${config.discord.guildId}/users/${member.id}/avatars/${member.avatar}.png`;
    
        const row = await LinkPlayerInfo.findOne({ where: { discord_id: interaction.user.id, steam_id: steamId } });
        if (!row) {
            await LinkPlayerInfo.create({
                steam_id: steamId,
                discord_id: interaction.user.id,
                picture: steamInfo.avatarfull,
                name: steamInfo.personaname,
                profile_url: steamInfo.profileurl,
                linked_date: time,
                discord_name: interaction.user.username,
                isBooster: doesBoost,
                isLinked: true,
                lastUpdated: time
            });
        } else {
            alreadyLinked = true;
            await row.update(
                { isLinked: true },
                { where: {
                    steam_id: steamId,
                    discord_id: interaction.user.id
                }}
            );
        }
    
        config.link.linkCommands.forEach(cmd => {
            if(cmd.onFirstLink && alreadyLinked) return;
            this.client.rcons.sendCommand(cmd.command.replace("{steamid}", steamId).replace("{name}", steamInfo.personaname), true);
        });
    
        LinkSavedCodes.destroy({ where: { userId: steamId } })
    
        this.client.rcons.sendCommand(`discordLink_updatePlayer ${steamId} ${interaction.user.id} true ${doesBoost} ${profilePicture} ${steamInfo.avatarfull} ${interaction.user.username}`);
    
        config.link.linkedRoles.forEach(role => { if(role.length > 10 && parseInt(role) != undefined) member?.roles.add(role) });
    
        this.syncRoles.forEach(role => { if(member.roles.cache.has(role)) this.client.rcons.sendCommand(`discordLink_roleChanged ${interaction.user.id} ${role} true`) })
    
        if(config.link.linkLogsChannelId) this.sendLinkEmbed(interaction, steamInfo, time);
    
        return `You have successfully linked to **[${steamInfo.personaname}](${steamInfo.profileurl})**`;
    }
    
    sendUnlinkEmbed(dbInfo) {
        let unlinkTime = (Date.now() / 1000).toString();
    
        config.link.unlinkCommands.forEach(cmd => {
            this.client.rcons.sendCommand(cmd.replace("{steamid}", dbInfo.steam_id), true, true);
        });
    
        if(unlinkTime.includes('.')) unlinkTime = unlinkTime.split('.')[0];
        let fields = [
            { inline: true, name: `Discord ID`, value: `${dbInfo.discord_id}` },
            { inline: true, name: `Discord User`, value: `<@${dbInfo.discord_id}>` },
            { inline: true, name: `Discord Name`, value: `${dbInfo.discord_name}` },
            { inline: true, name: `Steam ID`, value: `${dbInfo.steam_id}` },
            { inline: true, name: `Steam Name`, value: `${dbInfo.name}` },
            { inline: true, name: `Steam Profile`, value: `[${dbInfo.name}](${dbInfo.profile_url})` }
        ]
    
        let body = { color: config.link.unlinkEmbedColor, thumbnail: dbInfo.picture, description: `**Linked <t:${dbInfo.linked_date}>**\n**Unlinked <t:${unlinkTime}>**`, fields: fields, footer: {text: "Player Unlinked"} };
        this.fancyReply(body, config.link.unlinkLogsChannelId);
    }

    sendLinkEmbed(interaction, steamInfo, time) {
        let fields = [
            { inline: true, name: `Discord ID`, value: `${interaction.user.id}` },
            { inline: true, name: `Discord User`, value: `<@${interaction.user.id}>` },
            { inline: true, name: `Discord Name`, value: `${interaction.user.username}` },
            { inline: true, name: `Steam ID`, value: `${steamInfo.steamid}` },
            { inline: true, name: `Steam Name`, value: `${steamInfo.personaname}` },
            { inline: true, name: `Steam Profile`, value: `[${steamInfo.personaname}](${steamInfo.profileurl})` }
        ]
    
        let body = { color: config.link.linkEmbedColor, thumbnail: steamInfo.avatarfull, description: `**Linked <t:${time}>**`, fields: fields, footer: {text: "Player Linked"} };
        this.fancyReply(body, config.link.linkLogsChannelId);
    }

    async getSteamInfo(steamId) {
        return new Promise((resolve, reject) => {
            fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${config.steam.apiKey}&steamids=${steamId}`).then(res => res.text()).then(steam => {
                try {
                    steam = JSON.parse(steam);
                    if(!steam.response.players[0]) return;
                    const { personaname, avatarfull, profileurl, steamid, communityvisibilitystate } = steam.response.players[0];
    
                    resolve({ 'personaname': personaname, 'avatarfull': avatarfull, 'profileurl': profileurl, 'steamid': steamid, 'profilestatus': communityvisibilitystate });
                } catch (err) {
                    console.log(err);
                    resolve("Error while checking steam profile");
                }
            });    
        });
    }

    async checkIsLinked(interaction, steamId) {
        return await LinkPlayerInfo.findOne({ where: { discord_id: interaction.user.id, steam_id: steamId, isLinked: true } });
    }

    async checkIsDiscordLinked(discordId) {
        return await LinkPlayerInfo.findOne({ where: { discord_id: discordId, isLinked: true } });
    }

    async checkIsSteamLinked(steamId) {
        return await LinkPlayerInfo.findOne({ where: { steam_id: steamId } });
    }

    async fancyReply(body, channelId = null) {
        const embed = new EmbedBuilder();
        
        if(typeof body != "object") embed.setDescription(body);
        else {
            if(body.color) embed.setColor(body.color);
            if(body.thumbnail) embed.setThumbnail(body.thumbnail);
            if(body.description) embed.setDescription(body.description);
            if(body.fields) embed.setFields(body.fields);
            if(body.footer) embed.setFooter(body.footer).setTimestamp();
        }
    
        if(channelId !== null) {
            const channel = await this.client.channels.fetch(channelId);
            channel.send({ embeds: [embed] });
        }
    }

    async setActivity() {
        this.client.user.setPresence({ activities: [{ name: `${await this.getTotalLinked()} linked`, type: ActivityType.Watching }], status: 'online' });
        setInterval(async () => {
            this.client.user.setPresence({ activities: [{ name: `${await this.getTotalLinked()} linked`, type: ActivityType.Watching }], status: 'online' });
        }, 60000);
    }

    async getTotalLinked() {
        const { count, _ } = await LinkPlayerInfo.findAndCountAll({ where: { isLinked: true } });
        return count;
    }

    async memberUpdate(newStatus, oldStatus) {
        let wasBooster = oldStatus.premiumSince != null;
        let isBooster = newStatus.premiumSince != null;
        let oldRoles = oldStatus.roles.member._roles;
        let newRoles = newStatus.roles.member._roles;
        let oldPFP = oldStatus.avatar;
        let newPFP = newStatus.avatar;
        let isLinked = await this.checkIsDiscordLinked(newStatus.id);
        if(!isLinked) return;
    
        if(wasBooster != isBooster) {
            this.updateDatabase(newStatus.user.username, isBooster, newStatus.user.id);
            this.client.rcons.sendCommand(`discordLink_updatePlayer ${isLinked.steam_id} ${newStatus.id} true ${isBooster} ${profilePicture} false ${newStatus.displayName}`);
        } else if(oldRoles.length != newRoles.length) {
            let addedRoles = newStatus.roles.member._roles.filter(x => !oldStatus.roles.cache.has(x));
            let removedRoles = oldStatus.roles.member._roles.filter(x => !newStatus.roles.cache.has(x));
    
            for(let role of addedRoles) {
                if(!this.syncRoles.find(x => x == role)) continue;
                
                var add = this.addingRoles.find(x => x.discordId == oldStatus.id);
                if(add != undefined) {
                    const index = add.roles.indexOf(2);
                    add.roles.splice(index, 1);
                } else {
                    this.client.rcons.sendCommand(`discordLink_roleChanged ${newStatus.id} ${role} true`);
                }
            }
    
            for(let role of removedRoles) {
                if(!this.syncRoles.find(x => x == role)) continue;
    
                var remove = this.removingRoles.find(x => x.discordId == oldStatus.id);
                if(remove != undefined) {
                    const index = remove.roles.indexOf(2);
                    remove.roles.splice(index, 1);
                } else {
                    this.client.rcons.sendCommand(`discordLink_roleChanged ${newStatus.id} ${role} false`);
                }
            }
        } else if(newPFP != oldPFP) {
    
            let profilePicture;
            if(newPFP != null) profilePicture = `https://cdn.discordapp.com/guilds/${config.discord}/users/${newStatus.id}/avatars/${newStatus.avatar}.png`;
            else profilePicture = newStatus.user.displayAvatarURL().split(".webp")[0] + ".png";
    
            this.client.rcons.sendCommand(`discordLink_updatePlayer ${isLinked.steam_id} ${newStatus.id} true ${isBooster} ${profilePicture} false ${newStatus.displayName}`);
        }
    }
    
}

// function CreateLinkingSteps() {
//     config.LINKING_OPTIONS.LINKING_CHANNEL.CHANNEL_IDS.forEach(channelId => {
//         db.get('select * from embed_info where channelid = ?;', [channelId], async function(err, row) {
//             if(row && row != undefined) {
//                 const channel = client.channels.cache.get(channelId);
//                 if(!channel || channel == null || channel == undefined) return;
    
//                 channel.messages.fetch(row.embedId).then(message => { }).catch(err => {
//                     db.run("delete from embed_info where channelid = ?;", [channelId]);
//                     SendEmbed(channelId,  config.LINKING_OPTIONS.LINKING_CHANNEL.EMBED_OPTIONS);
//                 });
//             } else {
//                 SendEmbed(channelId,  config.LINKING_OPTIONS.LINKING_CHANNEL.EMBED_OPTIONS);
//             }
//         });
//     });
// }

// function SendEmbed(channelId, specialEmbed = false) {
//     const channel = client.channels.cache.get(channelId);
//     let embed;
//     if(!channel || channel == undefined || channel == null) return;

//     if(specialEmbed) {
//         embed = specialEmbed;
//         if(embed.color.includes("#")) embed.color = embed.color.split("#")[1];
//         embed.color = Number(`0x${embed.color}`);
//         embed.type = 'rich';
//     } else {
//         embed = new discord.EmbedBuilder();
//         if(footer) embed.setFooter({ text: footer }).setTimestamp();
//         if(color) embed.setColor(color);
//         if(description) embed.setDescription(description);
//         if(thumbnail) embed.setThumbnail(thumbnail);
//         if(image) embed.setImage(image);
//         if(author) embed.setAuthor(author);
//     }

//     channel.send({ embeds: [embed] }).then(message => { if(specialEmbed) AddEmbedinfo(message); });
// }

// function AddEmbedinfo(message) { db.run("insert into embed_info (embedId, channelid) values (?,?);", [message.id, message.channel.id]); }
//#endregion

module.exports = { LinkManager }