const express = require('express');
const authController = require('../controllers/authController')

const router = express.Router();

router.route('/resetPassword/:token').patch(authController.resetPassword);