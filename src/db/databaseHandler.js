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
    code: { type: DataTypes.STRING, primaryKey: true, unique: true },
    inviterId: DataTypes.BIGINT,
    uses: DataTypes.INTEGER
}, { freezeTableName: true });

const User = sequelize.define('User', {
    id: { type: DataTypes.BIGINT, primaryKey: true, unique: true },
    name: DataTypes.STRING
}, { freezeTableName: true });

try {
    sequelize.authenticate();
    console.log('Database connection has been established successfully');
    sequelize.sync({ alter: true });
} catch (e) {
    console.error('Unable to establish connection with database:', e);
}

module.exports = { sequelize, Invite, User }