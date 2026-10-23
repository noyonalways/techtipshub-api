import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import config from "../config";

// reset password
export const generateResetPasswordEmail = ({
  resetPasswordLink,
  fullName,
}: {
  resetPasswordLink: string;
  fullName: string;
}) => {
  return `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">
<html>

<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>Reset Your Password</title>
</head>

<body
  style="margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #333333; background-color: #f7f7f7;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%"
    style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="padding: 40px 10px; text-align: center; background-color: #3498db;">
        <h2 style="color: #ffffff; margin: 0;">
          <img src="https://cdn-icons-png.flaticon.com/128/14669/14669107.png" alt="Lock"
            style="vertical-align: middle; margin-right: 10px; width: 40px; height: 40px;">
          Reset Your Password
        </h2>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 10px;">
        <p style="margin: 0 0 20px;">Dear ${fullName},</p>
        <p style="margin: 0 0 20px;">We received a request to reset your password. If you didn't make this request,
          please ignore this email.</p>
        <p style="margin: 0 0 20px;">To reset your password, click the button below. This link will expire in 30 minutes
          for security reasons.</p>
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
          <tr>
            <td align="center">
              <a target="_blank" href="${resetPasswordLink}"
                style="display: inline-block; padding: 14px 30px; background-color: #3498db; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: bold;">
                Reset Password
              </a>
            </td>
          </tr>
        </table>
        <p style="margin: 0 0 20px;">If the button above doesn't work, you can also copy and paste the following link
          into your browser:</p>
        <p style="margin: 0 0 20px; word-break: break-all; color: #3498db;">${resetPasswordLink}</p>
        <table border="0" cellpadding="0" cellspacing="0" width="100%"
          style="margin-bottom: 20px; background-color: #f8f8f8; border-radius: 4px;">
          <tr>
            <td style="padding: 15px;">
              <p style="margin: 0; font-size: 14px; color: #666666;">
                <img src="https://cdn-icons-png.flaticon.com/128/1827/1827370.png" alt="Clock"
                  style="vertical-align: middle; margin-right: 10px; width: 16px; height: 16px;">
                This password reset link will expire in 30 minutes.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin: 0 0 20px;">For security reasons, please do not share this email or the reset link with anyone.
          Our support team will never ask for your password.</p>
        <p style="margin: 0 0 20px;">If you didn't request a password reset or need assistance, please contact our
          support team immediately.</p>
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="text-align: center;">
              <a href="mailto:contact.techtipshub@noyonrahman.com" style="color: #3498db; text-decoration: none;">
                <img src="https://cdn-icons-png.flaticon.com/128/561/561127.png" alt="Email"
                  style="vertical-align: middle; margin-right: 10px; width: 16px; height: 16px;">
                contact.techtipshub@noyonrahman.com
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 20px 30px; text-align: center; font-size: 14px; color: #666666; background-color: #f0f0f0;">
        <p>&copy; 2024 TechTipsHub. All rights reserved.</p>
        <p>
          <a target="_blank" href="https://facebook.com/noyonalways"
            style="color: #3498db; text-decoration: none; margin: 0 10px;">
            <img src="https://cdn-icons-png.flaticon.com/128/733/733547.png" alt="Facebook"
              style="width: 24px; height: 24px;">
          </a>
          <a target="_blank" href="https://twitter.com/noyonalways"
            style="color: #3498db; text-decoration: none; margin: 0 10px;">
            <img src="https://cdn-icons-png.flaticon.com/128/733/733579.png" alt="Twitter"
              style="width: 24px; height: 24px;">
          </a>
          <a target="_blank" href="https://instagram.com/noyonalways"
            style="color: #3498db; text-decoration: none; margin: 0 10px;">
            <img src="https://cdn-icons-png.flaticon.com/128/2111/2111463.png" alt="Instagram"
              style="width: 24px; height: 24px;">
          </a>
        </p>
      </td>
    </tr>
  </table>
</body>

</html>`;
};

// verify email
export const generateVerifyEmail = ({
  fullName,
  verifyEmailLink,
}: {
  fullName: string;
  verifyEmailLink: string;
}) => {
  return `
  <!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">
<html>

<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>Verify Your Email Address</title>
</head>

<body bgcolor="#f0f0f0" style="margin: 0; padding: 0; font-family: Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f0f0f0">
    <tr>
      <td align="center" valign="top">
        <table width="600" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" valign="top" bgcolor="#44d3d1" style="padding: 40px 0 30px 0;">
              <h2 style="color: #fff;">
                <img src="https://cdn-icons-png.flaticon.com/128/2530/2530973.png" alt="Check"
                  style="vertical-align: middle; margin-right: 10px; width: 40px; height: 40px;">
                Verify Email
              </h2>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="padding: 40px 10px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="color: #153643; font-family: Arial, sans-serif; font-size: 24px;">
                    <b>Verify Your Email Address</b>
                  </td>
                </tr>
                <tr>
                  <td
                    style="padding: 20px 0 30px 0; color: #153643; font-family: Arial, sans-serif; font-size: 16px; line-height: 20px;">
                    Dear ${fullName},<br><br>
                    Thank you for creating an account with TechTipsHub. To ensure the security of your
                    account and activate all features, please verify your email address by clicking the button below:
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <table border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center">
                          <a href="${verifyEmailLink}" target="_blank"
                            style="font-size: 16px; font-family: Arial, sans-serif; color: #ffffff; text-decoration: none; padding: 12px 30px; border: 1px solid #44d3d1; display: inline-block; background-color: #44d3d1; border-radius: 3px;">Verify
                            Email Address</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td
                    style="padding: 30px 0 0 0; color: #153643; font-family: Arial, sans-serif; font-size: 16px; line-height: 20px;">
                    If the button above doesn't work, please copy and paste the following link into your web browser:
                  </td>
                </tr>
                <tr>
                  <td
                    style="padding: 10px 0 0 0; font-family: Arial, sans-serif; font-size: 16px; line-height: 20px;">
                    <span style="color: #44d3d1; text-decoration: underline;">${verifyEmailLink}</span>
                  </td>
                </tr>
                <tr>
                  <td
                    style="padding: 30px 0 0 0; color: #153643; font-family: Arial, sans-serif; font-size: 16px; line-height: 20px;">
                    This link will expire in 24 hours for security reasons. If you did not create an account with us,
                    please disregard this email.<br><br>
                    If you have any questions or need assistance, please don't hesitate to contact us at
                    contact.techtipshub@noyonrahman.com.<br><br>
                    Best regards,<br>
                    TechTipsHub Team
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td bgcolor="#44d3d1" style="padding: 30px 30px 30px 30px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="color: #ffffff; font-family: Arial, sans-serif; font-size: 14px;" width="75%">
                    &copy; TechTipsHub 2023<br />

                  </td>
                  <td align="right" width="25%">
                    <table border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-family: Arial, sans-serif; font-size: 12px; font-weight: bold;">
                          <a href="http://www.twitter.com/" style="color: #ffffff;">
                            <img src="https://cdn-icons-png.flaticon.com/128/733/733579.png" alt="Twitter" width="24"
                              height="24" style="display: block;" border="0" />
                          </a>
                        </td>
                        <td style="font-size: 0; line-height: 0;" width="20">&nbsp;</td>
                        <td style="font-family: Arial, sans-serif; font-size: 12px; font-weight: bold;">
                          <a href="http://www.facebook.com/" style="color: #ffffff;">
                            <img src="https://cdn-icons-png.flaticon.com/128/5968/5968764.png" alt="Facebook" width="24"
                              height="24" style="display: block;" border="0" />
                          </a>
                        </td>
                        <td style="font-size: 0; line-height: 0;" width="20">&nbsp;</td>
                        <td style="font-family: Arial, sans-serif; font-size: 12px; font-weight: bold;">
                          <a href="http://www.facebook.com/" style="color: #ffffff;">
                            <img src="https://cdn-icons-png.flaticon.com/128/2111/2111463.png" alt="Facebook" width="24"
                              height="24" style="display: block;" border="0" />
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>

</html>`;
};

// delete blog email confirmation

export const deleteBlogEmailConfirmation = (
  blogTitle: string,
  reason: string,
) => {
  return `
  <!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">
<html>

<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>Blog Post Deletion Confirmation</title>
</head>

<body style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: Arial, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td style="padding: 20px 0;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="600"
          style="border-collapse: collapse; background-color: #ffffff; border: 1px solid #dedede;">
          <tr>
            <td align="center" style="padding: 40px 0 30px 0;">
              <img src="https://i.ibb.co.com/8dwgWQk/tech-tips-hub-logo.png" alt="Tech-Tips-Hub-Logo" width="60"
                style="display: block;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 20px 0 30px 0;">
              <h1 style="color: #333333; font-size: 24px; margin: 0;">Blog Post Deletion Confirmation</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 30px 40px 30px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td
                    style="color: #333333; font-family: Arial, sans-serif; font-size: 16px; line-height: 24px; padding: 20px 0 30px 0;">
                    We regret to inform you that your blog post titled "<span
                      style="font-weight: bold;">${blogTitle}</span>" has been deleted from our platform.
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 0; border: 1px solid #dedede; background-color: #f8f8f8;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding: 0 20px;">
                          <h2 style="color: #333333; font-size: 18px; margin: 0 0 10px 0;">Reason for Deletion:</h2>
                          <p style="color: #e53e3e; font-size: 16px; font-weight: bold; margin: 0;">${reason}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td
                    style="color: #333333; font-family: Arial, sans-serif; font-size: 16px; line-height: 24px; padding: 30px 0;">
                    If you believe this action was taken in error or if you have any questions, please don't hesitate to
                    contact our support team.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; border-top: 1px solid #dedede;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="color: #8898aa; font-family: Arial, sans-serif; font-size: 14px;">
                    This is an automated message. Please do not reply directly to this email.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>

</html>
  `;
};
