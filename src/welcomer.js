const { EmbedBuilder } = require('discord.js');
const config = require('../config.json');

class Welcomer {

    constructor(client) {
        this.embed = new EmbedBuilder()
            .setColor("#4A90E2")
            .setImage("https://i.imgur.com/fZ62BLc.png");
        this.client = client;
    }

    async sendWelcome(user) {
        const channel = await this.client.channels.fetch(config.discord.welcomeChannelId);
        this.embed.setDescription(`Welcome <@${user.id}> to **Rustwave**! We hope you enjoy your stay. Check out <#${config.discord.rulesChannelId}> and <#${config.discord.annoucementsChannelId}> to get started.`);
        channel.send({ embeds: [this.embed] });
    }

}

module.exports = { Welcomer }