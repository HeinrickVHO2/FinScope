import nodemailer from "nodemailer";

export function createTransporter() {
  const port = Number(process.env.MAIL_PORT || 465);
  const secure = process.env.MAIL_SECURE
    ? process.env.MAIL_SECURE === "true"
    : port === 465;

  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    console.warn("[MAILER] MAIL_USER ou MAIL_PASS nao configurados.");
  }

  return nodemailer.createTransport({
    host: process.env.MAIL_HOST || "smtp.titan.email",
    port,
    secure,
    auth: process.env.MAIL_USER && process.env.MAIL_PASS
      ? {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        }
      : undefined,
    connectionTimeout: Number(process.env.MAIL_CONNECTION_TIMEOUT_MS || 10000),
    greetingTimeout: Number(process.env.MAIL_GREETING_TIMEOUT_MS || 10000),
    socketTimeout: Number(process.env.MAIL_SOCKET_TIMEOUT_MS || 20000),
    tls: {
      rejectUnauthorized: process.env.MAIL_TLS_REJECT_UNAUTHORIZED === "true",
    },
    family: 4,
  } as nodemailer.TransportOptions);
}
