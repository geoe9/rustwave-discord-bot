const rustRcon = require('rustrcon');
const chalk = require('chalk');

class RconConnectionCollection {

    #rcons = [];

    constructor(client, servers) {
        servers.forEach(server => {
            this.#rcons.push(new RconConnection(client, server.shortname, server.ip, server.rconPort, server.rconPass));
        });
        this.client = client;
    }

    connect() {
        this.#rcons.forEach(server => {
            server.connect();
        });
    }

    sendCommand(command) {
        this.#rcons.forEach(server => {
            server.sendCommand(command);
        });
    }

}

class RconConnection {

    #commandQueue = [];

    constructor(client, shortname, ip, port, password) {
        this.rcon = new rustRcon.Client({
            ip: ip,
            port: port,
            password: password
        });
        this.shortname = shortname;
        this.client = client;

        this.rcon.on('error', err => {
            console.log(`[RCON Manager] Encountered an error while tring to connect to ${chalk.red(this.shortname)}\n:[ ${chalk.red("ERROR")} ]\n${err.message}`);
        });
    
        this.rcon.on('connected', () => {
            console.log(`[RCON Manager] Successfully connected to ${chalk.green(this.shortname)}`);
            this.connected = true;
            this.roleSync = setInterval(() => {
                this.getRoleSync();
            }, 30000);
        });
    
        this.rcon.on('disconnect', () => {
            clearInterval(roleSync);
            if(this.connected) {
                this.connected = false;
                console.log(`[RCON Manager] Dropped connection to ${chalk.red(this.shortname)}`);
            } else console.log(`[RCON Manager] Failed to connect to ${chalk.yellow(this.shortname)}`);
            setTimeout(() => this.connect, 30000);
        });
    
        this.rcon.on('message', async (message) => {
            if (message.Identifier != -1) return;
    
            let content = message.content;
    
            if (content.length < 1) return;
            if (content == "object") return;
    
            if (content.includes("DiscordLink")) {
                this.client.linkManager.recieveLinkCommand(content);
            }
        });

        setTimeout(() => {
            if(!this.#commandQueue.length == 0) return;
            this.#commandQueue.forEach(async (command, index) => {
                try {
                    await command.send(`${command}`, "RustwaveBot", 200);
                    this.#commandQueue.splice(index);
                } catch(err) { }
            });
        }, 60000);
    }

    connect() {
        console.log(`[RCON Manager] Attempting a connection to ${chalk.magenta(this.shortname)}`);
        this.rcon.login();
    }

    sendCommand(command) {
        try {
            this.rcon.send(`${command}`, "RustwaveBot", 200);
        } catch(err){
            console.log(err);
            this.#commandQueue.push(command);
        }
    }

    getRoleSync() {
        try { this.rcon.send("discordLink_getRolesToSync", "DiscordLink", 200); } catch(err) { 
            if(err.toString().includes("WebSocket is not open")) return; 
            else console.log(err);
        };
    }

}

module.exports = { RconConnection, RconConnectionCollection }