import nodemailer from "nodemailer";

console.log("MAIL_USER:", process.env.MAIL_USER);
console.log("MAIL_PASS:", process.env.MAIL_PASS ? "***" : "EMPTY");

export async function sendResetEmail(to: string, link: string) {
  const transporter = nodemailer.createTransport({
    host: "smtp.titan.email",
    port: 465,
    secure: true,
    auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
  family: 4 // 👈 força IPv4
} as nodemailer.TransportOptions);

  const html = `
<div style="font-family: Inter, Arial, sans-serif; background:#f7f7f7; padding:40px 0;">
  <div style="max-width: 520px; margin: auto; background:white; border-radius:14px; padding:40px; box-shadow: 0 8px 28px rgba(0,0,0,0.08);">

    <div style="text-align:center; margin-bottom:28px;">
      <img src="./client/public/Logo.png" alt="FinScope" style="width:130px; opacity:0.95;">
    </div>

    <h2 style="color:#1a1a1a; font-size:24px; font-weight:700; margin:0 0 12px;">
      Redefinição de senha
    </h2>

    <p style="color:#444; font-size:16px; line-height:24px; margin-bottom:24px;">
      Recebemos sua solicitação para redefinir sua senha.<br>
      Clique no botão abaixo para continuar.
    </p>

    <div style="text-align:center; margin: 40px 0;">
      <a href="${link}"
        style="
          background:#0066CC;
          padding:16px 32px;
          color:white;
          text-decoration:none;
          border-radius:10px;
          font-size:17px;
          font-weight:600;
          display:inline-block;
          box-shadow:0 5px 16px rgba(0,102,204,0.45);
        ">
        Redefinir senha
      </a>
    </div>

    <p style="color:#555; font-size:14px; line-height:22px;">
      Este link expira em <strong>15 minutos</strong>.<br>
      Se você não pediu isso, basta ignorar este email.
    </p>

    <hr style="border:none; border-top:1px solid #eee; margin:32px 0;">

    <p style="color:#999; font-size:12px; text-align:center;">
      © ${new Date().getFullYear()} FinScope<br>
      Controle financeiro moderno, intuitivo e poderoso.
    </p>

  </div>
</div>`;

  try {
    await transporter.sendMail({
      from: `"FinScope" <${process.env.MAIL_USER}>`,
      to,
      subject: "Redefinição de senha - FinScope",
      html,
    });

    console.log("📨 Email enviado com sucesso!");
  } catch (e) {
    console.error("❌ Erro ao enviar email:", e);
  } 
}
