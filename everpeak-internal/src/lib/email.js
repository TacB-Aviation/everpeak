import { WorkerMailer } from "worker-mailer";

/**
 * Sends email through Gmail's SMTP server using an App Password.
 * Requires these secrets to be set (see README):
 *   GMAIL_USER            e.g. yourname@gmail.com
 *   GMAIL_APP_PASSWORD    16-character app password (NOT your normal Gmail password)
 */
export async function sendMail(env, { to, subject, html, text }) {
  const mailer = await WorkerMailer.connect({
    credentials: {
      username: env.GMAIL_USER,
      password: env.GMAIL_APP_PASSWORD,
    },
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
  });

  await mailer.send({
    from: { name: "EverPeak Internal", email: env.GMAIL_USER },
    to: [{ email: to }],
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ""),
  });

  await mailer.close();
}

export function inviteEmailHtml({ inviteUrl, role, appName }) {
  const roleLabel = role === "manager" ? "Manager" : "Client Information Representative";
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: auto; padding: 24px; color:#1a1a1a;">
    <h2 style="margin-bottom:4px;">You've been invited to ${appName}</h2>
    <p>You've been added as a <strong>${roleLabel}</strong>.</p>
    <p>Click below to set your password and activate your account. This link expires in 24 hours and can only be used once.</p>
    <p style="margin: 28px 0;">
      <a href="${inviteUrl}" style="background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;">
        Activate my account
      </a>
    </p>
    <p style="font-size:12px;color:#666;">If the button doesn't work, copy this link into your browser:<br>${inviteUrl}</p>
    <p style="font-size:12px;color:#666;">If you weren't expecting this, you can safely ignore this email.</p>
  </div>`;
}
