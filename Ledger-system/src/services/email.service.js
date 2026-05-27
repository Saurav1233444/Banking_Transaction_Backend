
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        type: 'OAuth2',
        user: process.env.EMAIL_USER,
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        refreshToken: process.env.REFRESH_TOKEN,
    },
});

// Verify the connection configuration
transporter.verify((error, success) => {
    if (error) {
        console.error('Error connecting to email server:', error);
    } else {
        console.log('Email server is ready to send messages');
    }
});

// Function to send email
const sendEmail = async (to, subject, text, html) => {
    try {
        const info = await transporter.sendMail({
            from: `"Backend " <${process.env.EMAIL_USER}>`, // sender address
            to, // list of receivers
            subject, // Subject line
            text, // plain text body
            html, // html body
        });

        console.log('Message sent: %s', info.messageId);
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

async function sendRegistrationEmail(userEmail, name) {
    const subject = "Welcome to Backend";
    const text = `Hello ${name}, \n\n Thank you for registration at Backend`;
    const html = `<p>Hello ${name}, </p><p> Thank you for registration at Backend</p>`
    await sendEmail(userEmail, subject, text, html);

}
async function sendTransactionEmail(userEmail, name , amount, toAccount ){
    const subject = 'Transaction Sucessful!';
    const text = 'Hello ${name}, \n\n Your transaction of $${amount} to account is successfull';
    const html = `<p>Hello ${name}, </p><p>Your transaction is successfull`;
    await sendEmail(userEmail, subject ,  text, html)

}
async function sendTransactionFailureEmail(userEmail, name , amount, toAccount ){
    const subject = 'Transaction failed';
    const text = 'Hello ${name}, \n\n Your transaction of $${amount} to account is having trouble';
    const html = `<p>Hello ${name}, </p><p>Your transaction is having trouble`;
    await sendEmail(userEmail, subject ,  text, html)

}
module.exports = {  sendRegistrationEmail, sendTransactionEmail, sendTransactionFailureEmail };