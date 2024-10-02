const { contains } = require('validator');
const config = require('../config.json');
const { db, Invite, User } = require('./db/databaseHandler.js')
const { Op } = require('@sequelize/core')

module.exports = (client) => {
    // Get Discord server, we can use the cache here as it's not called until client is ready
    const guild = client.guilds.cache.get(config.discord.serverid);

    // Get all invites from server
    guild.invites.fetch().then(async invites => {
        const existingInvites = await Invite.findAll();
        const existingCodes = existingInvites.map(existingInvite => existingInvite.code);
        let updated = 0
        let created = 0
        invites.forEach(async invite => {
            if (existingCodes.includes(invite.code)) {
                const update = await Invite.update(
                    { uses: invite.uses },
                    {
                        where: {
                            code: invite.code,
                            uses: {
                                [Op.ne]: invite.uses
                            }
                        }
                    }
                )
                if (update[0] == 1) updated += 1;
            } else {
                const create = await Invite.create({
                    code: invite.code,
                    inviterId: invite.inviterId,
                    uses: invite.uses
                });
                if (create instanceof Invite) created += 1;
            }
        });
        console.log(`[Invite Manager] ${created} new invite(s) created, ${updated} invite(s) updated`)
    });
}