import nodemailer from "nodemailer";

export function createTransporter() {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    console.warn("[MAILER] MAIL_USER ou MAIL_PASS não configurados.");
  }

  return nodemailer.createTransport({
    host: process.env.MAIL_HOST || "smtp.titan.email",
    port: Number(process.env.MAIL_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
    family: 4,
  } as nodemailer.TransportOptions);
}
