const config = require('../config.json');
const rustRcon = require('rustrcon');
const { LinkPlayerInfo, LinkSavedCodes } = require('./db/database-handler.js');
const { ActivityType, EmbedBuilder } = require('discord.js');
const chalk = require('chalk');

const addingRoles = [];
const removingRoles = [];
const syncRoles = [];
const rcons = [];
const commandQueue = [];

module.exports = { connectAll, sendCommand, checkIsDiscordLinked, checkLinkingCode, setActivity, memberUpdate }

function connectAll(client) {
    config.servers.forEach((server) => {
        connectServer(client, server);
    });
}

function connectServer(client, server) {
    if (!server.enabled) return;

    let didSync = false;

    const rcon = new rustRcon.Client({
        ip: server.ip,
        port: server.rconPort,
        password: server.rconPass
    });

    server.connected = false
    rcons.push(rcon);

    function attemptConnection() {
        console.log(`[RCON Manager] Attempting a connection to ${chalk.magenta(server.shortname)}`);
        rcon.login();
    }

    attemptConnection();

    rcon.on('error', err => {
        console.log(`[RCON Manager] Encountered an error while tring to connect to ${chalk.red(server.shortname)}\n:[ ${chalk.red("ERROR")} ]\n${err.message}`);
    });

    rcon.on('connected', () => {
        console.log(`[RCON Manager] Successfully connected to ${chalk.green(server.shortname)}`);
        server.connected = true;
        roleSync = setInterval(() => {
            getRoleSync(rcon);
        }, 30000);
    });

    rcon.on('disconnect', () => {
        clearInterval(roleSync);
        if(server.connected) {
            server.connected = false;
            console.log(`[RCON Manager] Dropped connection to ${chalk.red(server.shortname)}`);
        } else console.log(`[RCON Manager] Failed to connect to ${chalk.yellow(server.shortname)}`);
        setTimeout(() => attemptConnection(), 30000);
    });

    rcon.on('message', async(message) => {
        let messageContent = message.content;
        let messageIdentifier = message.Identifier;
        if(messageIdentifier == -1) {
            if(messageContent.length < 1) return;
            if(typeof messageContent == "object") return;
            if(!messageContent.includes("DiscordLink")) return;
            messageContent = messageContent.replace("\n", "");
            let action = messageContent.slice(0, messageContent.indexOf('||')).split(".")[1];
            let theJson = JSON.parse(messageContent.slice(messageContent.indexOf("||") + 2));

            switch(action) {
                case "Generated":
                    addCodeToDatabase(theJson);
                    break;
                case "Unlinked":
                    unlinkPlayer(client, theJson.steamId);
                    break;
                case "RoleChanged":
                    roleChanged(client, theJson);
                    break;
                case "CheckStatus":
                    checkLinkStatus(client, theJson);
                    break;
                case "VerifyUnlink":
                    sendCommand(`discordLink_unlinkPlayer ${theJson.SteamID}`);
                    break;
                case "RolesToSync":
                    theJson.rolesToSync.forEach(role => { if(!syncRoles.includes(role)) syncRoles.push(role) });    
                    if(!didSync) {
                        roleSync = null;
                        didSync = true;
                    }                
                    break;
            }
        }
    });
}

function sendCommand(command) {
    rcons.forEach((rcon, index) => {
        try {
            rcon.send(`${command}`, "discordLink", 200);
        } catch(err){
            console.log(err);

            // if(isConfigCommand && config.SUCCESSFULLY_RAN_COMMANDS_WEBHOOK) {0
            //     let webhook = new discord.WebhookClient({ url: config.SUCCESSFULLY_RAN_COMMANDS_WEBHOOK });
            //     const embed = new discord.EmbedBuilder().setColor("#ff5454")
            //     .setDescription(`**COULDNT SEND (${index}):** `+ "``" + command + "``");
            //     webhook.send({ embeds: [embed] });
            // }

            commandQueue.push({ rconId: index, command: command });
        }
    });
}

setTimeout(() => {
    if(!commandQueue.length == 0) return;
    commandQueue.forEach(command => {
        try {
            rcons[command.id].send(`${command}`, "discordLink", 200);
            const arrayIndex = rcons.indexOf(2);
            rcons.splice(arrayIndex, arrayIndex);
        } catch(err) { }
    });
}, 60000);

//#region Methods
async function checkLinkStatus(client, data) {
    const isLinked = await checkIsSteamLinked(data.steamId);
    if(!isLinked) return;

    const guild = client.guilds.cache.get(config.discord.guildId);
    const member = guild.members.cache.get(isLinked.discord_id);
    let lastUpdate = isLinked.lastUpdated;
    let steamData = { name: isLinked.name, profile_url: isLinked.profile_url, picture: isLinked.picture };
    let profilePicture;

    if(lastUpdate + 24 < Date.now()) {
        const steamInfo = await getSteamInfo(data.steamId);
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
        //db.run('update player_info set picture = ?, name = ?, profile_url = ?, lastUpdated = ? where steam_id = ? and isLinked = ?', [steamData.picture, steamData.personaname, steamData.profile_url, lastUpdate, isLinked.steam_id, true]);
    }
    
    data.groups.forEach(role => {  
        if(!member.roles.cache.has(role.Value)) {
            var add = addingRoles.find(x => x.discordId == member.id);
            if(add != undefined) {
                add.roles.push(role.Value);
            } else {
                addingRoles.push({ discordId: member.id, roles: [role] });
            }

            member.roles.add(role.Value);
        }
    });

    syncRoles.forEach(role => {  
        if(member.roles.cache.has(role) && !data.groups.includes(x => x.Value))
            {
                var remove = removingRoles.find(x => x.discordId == member.id);
                if(remove != undefined) {
                    remove.roles.push(role.Value);
                } else {
                    removingRoles.push({ discordId: member.id, roles: [role] });
                }

                member.roles.remove(role);
            }
     });

    if(member.avatar != null) profilePicture = `https://cdn.discordapp.com/guilds/${config.discord.guildId}/users/${member.id}/avatars/${member.avatar}.png`;
    else profilePicture = member.user.displayAvatarURL().split(".webp")[0] + ".png";

    sendCommand(`discordLink_updatePlayer ${isLinked.steam_id} ${isLinked.discord_id} true ${member.premiumSince != null} ${profilePicture} ${steamData.picture} ${member.displayName}`);
    if(config.SYNC_STEAM_NAMES_TO_DISCORD && guild.ownerId != member.id) member.setNickname(steamData.name);
}

async function roleChanged(client, data) {
    const isLinked = await checkIsDiscordLinked(data.discordId);
    if(!isLinked) return;

    const guild = client.guilds.cache.get(config.discord.guildId);
    const member = guild.members.cache.get(data.discordId);

    if(member == undefined || member == null) return;
    if(data.roleId.length < 10 || parseInt(data.roleId) == undefined) return;

    if(data.added) member.roles.add(data.roleId);
    else member.roles.remove(data.roleId);
}

function getRoleSync(rcon) {
    try { rcon.send("discordLink_getRolesToSync", "DiscordLink", 200); } catch(err) { 
        if(err.toString().includes("WebSocket is not open")) return; 
        else console.log(err);
    };
}

function updateDatabase(userName, isBooster, discordId) {
    LinkPlayerInfo.update(
        { discord_name: userName, isBooster: isBooster },
        { where: { discord_id: discordId } }
    );
    //db.run("update player_info set discord_name = ?, isBooster = ? where discord_id = ?;", [userName, isBooster, discordId])
}

async function unlinkPlayer(client, steamId) {
    const isLinked = await checkIsSteamLinked(steamId);

    const guild = client.guilds.cache.get(config.discord.guildId);
    const member = guild.members.cache.get(isLinked.discord_id);

    if(member != undefined && member != null) {
        config.link.linkedRoles.forEach(role => {
            if(role.length > 10 && parseInt(role) != undefined) member.roles.remove(role);
        });

        syncRoles.forEach(role => {
            if(role.length > 10 && parseInt(role) != undefined) member.roles.remove(role);
        });
    }

    if(isLinked) {
        LinkPlayerInfo.update(
            { isLinked: false },
            { where: { steam_id: steamId } }
        )
        //db.run("update player_info set isLinked = ? where steam_id = ?;", [false, steamId]);
        sendUnlinkEmbed(client, isLinked);
    }
}

async function addCodeToDatabase(info) {
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
    // db.get("select * from saved_codes where userId = ?;", [info.userId], async function(err, row) {
    //     if(row) db.run("update saved_codes set code = ?, displayName = ? where userId = ?", [info.code, info.displayName, info.userId]);
    //     else db.run("INSERT INTO saved_codes (userId, displayName, code) VALUES (?, ?, ?);", [info.userId, info.displayName, info.code]);
    // });
}

async function checkLinkingCode(code, interaction) {
    let isLinked = await checkIsDiscordLinked(interaction.user.id);
    if (isLinked) return `You are already linked to **[${isLinked.name}](${isLinked.profile_url})**`;
    const row = await LinkSavedCodes.findOne({ where: { code: code } });
    if (row === null) {
        return "The code that you provided is not valid or has expired";
    }
    return await linkUser(row.userId, interaction);
}

async function linkUser(steamId, interaction) {
    let steamInfo = await getSteamInfo(steamId);

    if(typeof steamInfo != "object") {
        const embed = new discord.EmbedBuilder()
            .setColor(config.DEFAULT_EMBED_COLOR)
            .setDescription(steamId);
        interaction.editReply({ embeds: [embed], ephemeral: true });
        return;
    }

    let profilePicture = interaction.user.displayAvatarURL();
    if(profilePicture.includes(".webp")) profilePicture.split(".")[0] + ".png";
    const guild = await interaction.client.guilds.fetch(config.discord.guildId);
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
        sendCommand(cmd.COMMAND.replace("{steamid}", steamId).replace("{name}", steamInfo.personaname), true);
    });

    LinkSavedCodes.destroy({ where: { userId: steamId } })

    sendCommand(`discordLink_updatePlayer ${steamId} ${interaction.user.id} true ${doesBoost} ${profilePicture} ${steamInfo.avatarfull} ${interaction.user.username}`);

    config.link.linkedRoles.forEach(role => { if(role.length > 10 && parseInt(role) != undefined) member?.roles.add(role) });

    syncRoles.forEach(role => { if(member.roles.cache.has(role)) sendCommand(`discordLink_roleChanged ${interaction.user.id} ${role} true`) })

    if(config.link.linkLogsChannelId) sendLinkEmbed(interaction, steamInfo, time);

    return `You have successfully linked to **[${steamInfo.personaname}](${steamInfo.profileurl})**`;
}

function sendUnlinkEmbed(client, dbInfo) {
    let unlinkTime = (Date.now() / 1000).toString();

    config.link.unlinkCommands.forEach(cmd => {
        sendCommand(cmd.replace("{steamid}", dbInfo.steam_id), true, true);
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
    fancyReply(client, body, config.link.unlinkLogsChannelId);
}

function sendLinkEmbed(interaction, steamInfo, time) {
    let fields = [
        { inline: true, name: `Discord ID`, value: `${interaction.user.id}` },
        { inline: true, name: `Discord User`, value: `<@${interaction.user.id}>` },
        { inline: true, name: `Discord Name`, value: `${interaction.user.username}` },
        { inline: true, name: `Steam ID`, value: `${steamInfo.steamid}` },
        { inline: true, name: `Steam Name`, value: `${steamInfo.personaname}` },
        { inline: true, name: `Steam Profile`, value: `[${steamInfo.personaname}](${steamInfo.profileurl})` }
    ]

    let body = { color: config.LINK_EMBED_COLOR, thumbnail: steamInfo.avatarfull, description: `**Linked <t:${time}>**`, fields: fields, footer: {text: "Player Linked"} };
    fancyReply(interaction.client, body, config.link.linkLogsChannelId);
}

async function getSteamInfo(steamId) {
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

async function checkIsLinked(interaction, steamId) {
    return await LinkPlayerInfo.findOne({ where: { discord_id: interaction.user.id, steam_id: steamId, isLinked: true } });
}

async function checkIsDiscordLinked(discordId) {
    return await LinkPlayerInfo.findOne({ where: { discord_id: discordId, isLinked: true } });
}

async function checkIsSteamLinked(steamId) {
    return await LinkPlayerInfo.findOne({ where: { steam_id: steamId } });
}

async function fancyReply(client, body, channelId = null) {
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
        const channel = await client.channels.fetch(channelId);
        channel.send({ embeds: [embed] });
    }
}

async function setActivity(client) {
    client.user.setPresence({ activities: [{ name: `${await getTotalLinked()} linked`, type: ActivityType.Watching }], status: 'online' });
    setInterval(async () => {
        client.user.setPresence({ activities: [{ name: `${await getTotalLinked()} linked`, type: ActivityType.Watching }], status: 'online' });
    }, 60000);
}

async function getTotalLinked() {
    const { count, _ } = await LinkPlayerInfo.findAndCountAll({ where: { isLinked: true } });
    return count;
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

async function memberUpdate(newStatus, oldStatus) {
    let wasBooster = oldStatus.premiumSince != null;
    let isBooster = newStatus.premiumSince != null;
    let oldRoles = oldStatus.roles.member._roles;
    let newRoles = newStatus.roles.member._roles;
    let oldPFP = oldStatus.avatar;
    let newPFP = newStatus.avatar;
    let isLinked = await checkIsDiscordLinked(newStatus.id);
    if(!isLinked) return;

    if(wasBooster != isBooster) {
        updateDatabase(newStatus.user.username, isBooster, newStatus.user.id);
        sendCommand(`discordLink_updatePlayer ${isLinked.steam_id} ${newStatus.id} true ${isBooster} ${profilePicture} false ${newStatus.displayName}`);
    } else if(oldRoles.length != newRoles.length) {
        let addedRoles = newStatus.roles.member._roles.filter(x => !oldStatus.roles.cache.has(x));
        let removedRoles = oldStatus.roles.member._roles.filter(x => !newStatus.roles.cache.has(x));

        for(let role of addedRoles) {
            if(!syncRoles.find(x => x == role)) continue;
            
            var add = addingRoles.find(x => x.discordId == oldStatus.id);
            if(add != undefined) {
                const index = add.roles.indexOf(2);
                add.roles.splice(index, 1);
            } else {
                sendCommand(`discordLink_roleChanged ${newStatus.id} ${role} true`);
            }
        }

        for(let role of removedRoles) {
            if(!syncRoles.find(x => x == role)) continue;

            var remove = removingRoles.find(x => x.discordId == oldStatus.id);
            if(remove != undefined) {
                const index = remove.roles.indexOf(2);
                remove.roles.splice(index, 1);
            } else {
                sendCommand(`discordLink_roleChanged ${newStatus.id} ${role} false`);
            }
        }
    } else if(newPFP != oldPFP) {

        let profilePicture;
        if(newPFP != null) profilePicture = `https://cdn.discordapp.com/guilds/${config.DISCORD_SERVER_ID}/users/${newStatus.id}/avatars/${newStatus.avatar}.png`;
        else profilePicture = newStatus.user.displayAvatarURL().split(".webp")[0] + ".png";

        sendCommand(`discordLink_updatePlayer ${isLinked.steam_id} ${newStatus.id} true ${isBooster} ${profilePicture} false ${newStatus.displayName}`);
    }
}