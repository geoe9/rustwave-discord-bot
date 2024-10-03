const config = require('../../config.json')
const { Sequelize, DataTypes, Model } = require('@sequelize/core');
const { MariaDbDialect } = require('@sequelize/mariadb')
 
const sequelize = new Sequelize({
    dialect: MariaDbDialect,
    database: config.db.name,
    user: config.db.user,
    password: config.db.password,
    host: config.db.host,
    port: 3306,
    showWarnings: true,
    connectTimeout: 1000
});

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
        tableName: "InviteTracker"
    }
)

try {
    sequelize.authenticate();
    console.log('Database connection has been established successfully');
    sequelize.sync({ alter: true });
} catch (e) {
    console.error('Unable to establish connection with database:', e);
}

module.exports = { InviteTracker }