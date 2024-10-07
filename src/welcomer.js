const { EmbedBuilder } = require('discord.js');
const config = require('../config.json');

class Welcomer {

    constructor(client) {
        this.embed = new EmbedBuilder()
            .setColor()
            .setImage();
        this.client = client;
    }

    sendWelcome(user) {
        const channel = this.client.channels.fetch(config.discord.welcomeChannelId);
        this.embed.setDescription(`Welcome <@${user.id}> to **Rustwave**! We hope you enjoy your stay. Check out <#${config.discord.rulesChannelId}> and <#${config.discord.annoucementsChannelId}> to get started.`);
        channel.send({ embeds: [this.embed] });
    }

}

module.exports = { Welcomer }