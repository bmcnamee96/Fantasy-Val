// models/League.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Adjust path as necessary

const League = sequelize.define('league', {
    league_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        field: 'league_id' // Map to the correct column name
      },
    league_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    owner_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'users', // Ensure this matches the actual table name
        key: 'user_id'
      }
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'created_at' // Map to the correct column name
      }
}, {
    timestamps: false // If you are not using `updated_at` or `created_at` for automatic timestamps
});
  
  module.exports = League;
