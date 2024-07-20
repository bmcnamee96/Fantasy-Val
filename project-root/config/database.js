// config/database.js
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('fan_val', 'postgres', 'pgadmin', {
  host: 'localhost',
  dialect: 'postgres'
});

module.exports = sequelize;
