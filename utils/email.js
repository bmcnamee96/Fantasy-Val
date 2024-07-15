const nodemailer = require('nodemailer');

const sendPasswordResetEmail = async(option) => {
    // CREATE A TRANSPORTER
    const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        auth: {
            user: process.env.EMAIL_USER,
            password: process.env.EMAIL_PASSWORD
        }
    })

    // DEFINE EMAIL OPTIONS
    const emailOPtions = {
        from: 'Fantasty Val support<support@fanval.com>',
        to: option.email,
        subject: option.subject,
        text: option.message
    }

    await transporter.sendMail(emailOptions);
}

module.exports = sendPasswordResetEmail;