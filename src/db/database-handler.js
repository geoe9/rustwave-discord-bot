const { Sequelize, DataTypes, Model } = require('sequelize');
 
// const sequelize = new Sequelize({
//     dialect: MariaDbDialect,
//     database: config.db.name,
//     user: config.db.user,
//     password: config.db.password,
//     host: config.db.host,
//     port: 3306,
//     showWarnings: true,
//     connectTimeout: 1000
// });

const sequelize = new Sequelize('db', "", "", {
    dialect: 'sqlite',
    storage: './src/db/db.sqlite',
    logging: false
});

class LinkPlayerInfo extends Model { }
LinkPlayerInfo.init(
    {
        steam_id: { type: DataTypes.STRING },
        discord_id: { type: DataTypes.STRING },
        picture: { type: DataTypes.STRING },
        name: { type: DataTypes.STRING },
        profile_url: { type: DataTypes.STRING },
        linked_date: { type: DataTypes.STRING },
        discord_name: { type: DataTypes.STRING },
        isBooster: { type: DataTypes.BOOLEAN },
        isLinked: { type: DataTypes.BOOLEAN },
        lastUpdated: { type: DataTypes.STRING },
    },
    {
        sequelize,
        tableName: "link_playerinfo"
    }
)

class LinkSavedCodes extends Model { }
LinkSavedCodes.init(
    {
        userId: { type: DataTypes.STRING },
        displayName: { type: DataTypes.STRING },
        code: { type: DataTypes.STRING }
    },
    {
        sequelize,
        tableName: "link_savedcodes"
    }
)

class LinkEmbedInfo extends Model { }
LinkEmbedInfo.init(
    {
        embedId: { type: DataTypes.BIGINT },
        channelid: { type: DataTypes.BIGINT }
    },
    {
        sequelize,
        tableName: "link_embedinfo"
    }
)

class InviteTracker extends Model {
    getTotalInvites() {
        return [this.realInvites + this.fakeInvites];
    }
}
InviteTracker.init(
    {
        id: { type: DataTypes.BIGINT, primaryKey: true, unique: true },
        name: DataTypes.STRING,
        realInvites: DataTypes.INTEGER,
        fakeInvites: DataTypes.INTEGER
    },
    {
        sequelize,
        tableName: "invite_tracker"
    }
)

try {
    sequelize.authenticate();
    console.log('Database connection has been established successfully');
    sequelize.sync();
} catch (e) {
    console.error('Unable to establish connection with database:', e);
}

module.exports = { InviteTracker, LinkPlayerInfo, LinkSavedCodes }