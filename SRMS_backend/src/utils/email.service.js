const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

async function sendOtpEmail(toEmail, otp, purpose = "login") {
    await transporter.sendMail({
        from: `"SRMS Connect" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject: `Your SRMS Connect ${purpose === "password reset" ? "Password Reset" : "Login"} OTP`,
        html: `
            <p>Your OTP for ${purpose} is:</p>
            <h2>${otp}</h2>
            <p>This OTP is valid for 5 minutes. Do not share it with anyone.</p>
        `
    });
}

module.exports = { sendOtpEmail };