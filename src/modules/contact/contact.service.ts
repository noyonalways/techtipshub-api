import httpStatus from "http-status";
import config from "../../config";
import AppError from "../../errors/AppError";
import sendEmail from "../../utils/sendEmail";

export type TContactPayload = {
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  message: string;
};

/** Restrict how often one visitor can submit the form. */
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_WINDOW = 5;
const submissions = new Map<string, number[]>();

const isRateLimited = (key: string): boolean => {
  const now = Date.now();
  const recent = (submissions.get(key) || []).filter(
    (ts) => now - ts < WINDOW_MS,
  );

  if (recent.length >= MAX_PER_WINDOW) {
    submissions.set(key, recent);
    return true;
  }

  recent.push(now);
  submissions.set(key, recent);
  return false;
};

// Keep the map from growing without bound on a long-running process.
const prune = () => {
  const now = Date.now();
  for (const [key, stamps] of submissions) {
    const recent = stamps.filter((ts) => now - ts < WINDOW_MS);
    if (recent.length === 0) submissions.delete(key);
    else submissions.set(key, recent);
  }
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const create = async (payload: TContactPayload, requestKey: string) => {
  if (isRateLimited(requestKey)) {
    throw new AppError(
      httpStatus.TOO_MANY_REQUESTS,
      "Too many messages sent. Please try again later.",
    );
  }

  if (submissions.size > 500) prune();

  const inbox = config.contact_inbox;

  if (!inbox) {
    // Never claim a message was delivered when there is nowhere to send it.
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      "The contact form is temporarily unavailable. Please email us directly.",
    );
  }

  const fullName = `${payload.firstName} ${payload.lastName}`.trim();
  const safe = {
    fullName: escapeHtml(fullName),
    email: escapeHtml(payload.email),
    subject: escapeHtml(payload.subject),
    message: escapeHtml(payload.message).replace(/\n/g, "<br />"),
  };

  try {
    await sendEmail({
      to: {
        name: "TechTips Hub",
        address: inbox,
      },
      subject: `[Contact] ${payload.subject}`,
      throwOnError: true,
      text: [
        `From: ${fullName} <${payload.email}>`,
        "",
        payload.message,
      ].join("\n"),
      html: `
      <div style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; line-height: 1.6; color: #111">
        <h2 style="margin: 0 0 16px">New contact form submission</h2>
        <p style="margin: 0 0 4px"><strong>Name:</strong> ${safe.fullName}</p>
        <p style="margin: 0 0 4px"><strong>Email:</strong> ${safe.email}</p>
        <p style="margin: 0 0 16px"><strong>Subject:</strong> ${safe.subject}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0" />
        <p style="white-space: normal">${safe.message}</p>
      </div>
    `,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Contact form delivery failed:", error);
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      "We could not send your message right now. Please email us directly.",
    );
  }

  return { received: true };
};

export const contactService = { create };
