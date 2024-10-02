const config = require('../../config.json')
const { Sequelize, DataTypes } = require('@sequelize/core');
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

const Invite = sequelize.define('Invite', {
    id: { type: DataTypes.BIGINT, primaryKey: true },
    code: DataTypes.STRING,
    inviterid: DataTypes.BIGINT,
    uses: DataTypes.INTEGER
}, { freezeTableName: true });

const User = sequelize.define('User', {
    id: { type: DataTypes.BIGINT, primaryKey: true },
    name: DataTypes.STRING
}, { freezeTableName: true });

async function connect() {
    try {
        await sequelize.authenticate();
        console.log('Database connection has been established successfully.');
    } catch (e) {
        console.error('Unable to establish connection with database', e);
    }
}

connect()

module.exports = { sequelize, Invite, User }