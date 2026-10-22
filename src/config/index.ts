import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
  port: process.env.PORT,
  database_url: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
  api_base_url: process.env.API_BASE_URL,
  client_base_url: process.env.CLIENT_BASE_URL,

  // access and refresh token
  jwt_access_token_secret: process.env.JWT_ACCESS_TOKEN_SECRET,
  jwt_refresh_token_secret: process.env.JWT_REFRESH_TOKEN_SECRET,
  jwt_access_token_expires_in: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN,
  jwt_refresh_token_expires_in: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN,

  // rest password token
  jwt_reset_password_secret: process.env.JWT_RESET_PASSWORD_SECRET,
  jwt_reset_password_expires_in: process.env.JWT_RESET_PASSWORD_EXPIRES_IN,
  reset_password_ui_url: process.env.RESET_PASSWORD_UI_URL,

  // smtp email send
  smtp_auth_user: process.env.SMTP_AUTH_USER,
  smtp_auth_password: process.env.SMTP_AUTH_PASSWORD,
  nodemailer_email_from: process.env.NODEMAILER_EMAIL_FROM,
  // Inbox that contact-form submissions are delivered to. Falls back to the
  // sending address so the form always has a real destination.
  contact_inbox:
    process.env.CONTACT_INBOX || process.env.NODEMAILER_EMAIL_FROM,

  // hash password
  bcrypt_salt_round: process.env.BCRYPT_SALT_ROUND,

  // cloudinary config
  cloud_name: process.env.CLOUD_NAME,
  cloudinary_api_key: process.env.CLOUDINARY_API_KEY,
  cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET,

  // aamarpay payment gateway
  aamarpay_gateway_base_url: process.env.AAMARPAY_GATEWAY_BASE_URL,
  aamarpay_store_id: process.env.AAMARPAY_STORE_ID,
  aamarpay_signature_key: process.env.AAMARPAY_SIGNATURE_KEY,
};
