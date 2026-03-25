import nodemailer from "nodemailer";
import configService from "./configClass.js";

const transport = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: configService.getOrThrow("EMAIL"),
    pass: configService.getOrThrow("pASSWORD"),
  },
});

// test email

// const info = await transport.sendMail({
//   from: configService.getOrThrow("EMAIL"),
//   to: "olexxee14@gmail.com",
//   subject: "Test Email",
//   text: "This is a test email",
// });

export default transport;
