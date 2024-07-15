const nodemailer = require('nodemailer');

// Create transporter outside of the function
const transporter = nodemailer.createTransport({
  host: "sandbox.smtp.mailtrap.io",
  port: 2525,
  auth: {
    user: "7385a77f8f19cc",
    pass: "1bc3d8ca184b1e"
  }
});

// Function to send password reset email
async function sendPasswordResetEmail(email, token) {
  const resetLink = `http://your-frontend-url/reset-password?token=${token}`;
  const mailOptions = {
    from: 'Fantasty Val support<support@fanval.com>',
    to: email,
    subject: 'Password Reset Request',
    text: `You requested a password reset. Click the link to reset your password: ${resetLink}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Error sending email');
  }
}

module.exports = { sendPasswordResetEmail };

