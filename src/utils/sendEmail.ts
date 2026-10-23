import nodemailer from "nodemailer";
import config from "../config";

const port = Number(process.env.SMTP_PORT) || 465;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port,
  secure: port === 465,
  auth: {
    user: config.smtp_auth_user,
    pass: config.smtp_auth_password,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

/**
 * Whether outgoing mail can actually be sent. True only when a real SMTP user
 * is configured; the example value ("your_smtp_auth_user_email") is treated as
 * missing. Callers that must not claim a delivery check this first.
 */
const isEmailConfigured = () => {
  const user = String(config.smtp_auth_user ?? "").trim();
  return Boolean(user && user.includes("@") && !user.startsWith("your_"));
};

type TSendEmail = {
  to: {
    name: string;
    address: string;
  };
  subject: string;
  text: string;
  html: string;
  /**
   * When true, a failed send rejects instead of being logged and swallowed.
   * Legacy flows (password reset) rely on the old best-effort
   * behaviour, so this defaults to false.
   */
  throwOnError?: boolean;
};

const sendEmail = async ({
  to: { name, address },
  subject,
  text,
  html,
  throwOnError = false,
}: TSendEmail) => {
  try {
    // send mail with defined transport object
    await transporter.sendMail({
      from: {
        name: "TechTipsHub",
        address: config.nodemailer_email_from as string,
      },
      to: {
        name: name,
        address: address,
      }, // list of receivers
      subject,
      text,
      html,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(error);
    // Re-throw so callers that must not claim a delivery (e.g. the contact
    // form) can report the failure instead of silently succeeding.
    if (throwOnError) throw error;
  }
};

export default sendEmail;
export { isEmailConfigured };
