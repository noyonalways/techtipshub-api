import httpStatus from "http-status";
import mongoose from "mongoose";
import { QueryBuilder } from "../../builder";
import config from "../../config";
import AppError from "../../errors/AppError";
import sendEmail from "../../utils/sendEmail";
import { adminLogService } from "../admin/admin-log.service";
import User from "../user/user.model";
import Contact, { CONTACT_STATUSES, TContactStatus } from "./contact.model";

/** Fields the inbox may be sorted by. Anything else is a 400. */
const CONTACT_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "firstName",
  "lastName",
  "email",
  "subject",
  "status",
  "handledAt",
] as const;

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

  // Persist first: if the mail fails the admin still finds the message in the
  // inbox, and the visitor is told it could not be delivered.
  await Contact.create({
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email,
    subject: payload.subject,
    message: payload.message,
    status: "new",
  });

  try {
    await sendEmail({
      to: {
        name: "TechTipsHub",
        address: inbox,
      },
      subject: `[Contact] ${payload.subject}`,
      throwOnError: true,
      text: [`From: ${fullName} <${payload.email}>`, "", payload.message].join(
        "\n",
      ),
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

const getAll = async (query: Record<string, unknown>) => {
  // Whitelisted keys only: QueryBuilder.filter() would otherwise splice the raw
  // query string into the Mongo filter.
  const parsed: Record<string, unknown> = {};

  if (typeof query.searchTerm === "string" && query.searchTerm.trim())
    parsed.searchTerm = query.searchTerm;
  if (typeof query.page === "string" && query.page) parsed.page = query.page;
  if (typeof query.limit === "string" && query.limit)
    parsed.limit = query.limit;
  if (typeof query.fields === "string" && query.fields)
    parsed.fields = query.fields;

  const sort = typeof query.sort === "string" ? query.sort.trim() : "";
  if (sort) {
    const fields = sort.split(",").map((part) => part.trim());
    const allowed = new Set<string>([...CONTACT_SORT_FIELDS, "_id"]);

    for (const field of fields) {
      const name = field.replace(/^[-+]/, "");
      if (!allowed.has(name)) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Invalid sort field "${name}". Allowed: ${CONTACT_SORT_FIELDS.join(", ")}`,
        );
      }
    }

    parsed.sort = fields.join(",");
  }

  const status = typeof query.status === "string" ? query.status.trim() : "";
  if (status && status !== "all") {
    if (!CONTACT_STATUSES.includes(status as TContactStatus)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Status must be one of new, read, archived",
      );
    }
    parsed.status = status;
  }

  const contactQuery = new QueryBuilder(
    Contact.find({}).populate({
      path: "handledBy",
      select: "fullName username profilePicture",
    }),
    parsed,
  ).search(["firstName", "lastName", "email", "subject"]);

  await contactQuery.filter();

  if (!parsed.sort) {
    contactQuery.sortBy("-createdAt,-_id");
  } else {
    contactQuery.sort();
  }

  contactQuery.paginate().fields();

  const [result, meta, counts] = await Promise.all([
    contactQuery.modelQuery,
    contactQuery.countTotal(),
    getCounts(),
  ]);

  return { result, meta, counts };
};

const getCounts = async () => {
  const grouped = await Contact.aggregate<{
    _id: TContactStatus;
    count: number;
  }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]);

  const counts = { new: 0, read: 0, archived: 0 };
  for (const row of grouped) {
    if (row._id in counts) counts[row._id] = row.count;
  }

  return counts;
};

const getSingle = async (id: string) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid contact id");
  }

  const contact = await Contact.findById(id).populate({
    path: "handledBy",
    select: "fullName username profilePicture",
  });
  if (!contact) {
    throw new AppError(httpStatus.NOT_FOUND, "Contact message not found");
  }

  return contact;
};

const updateStatus = async (
  id: string,
  status: TContactStatus,
  adminEmail?: string,
) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid contact id");
  }

  if (!CONTACT_STATUSES.includes(status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Status must be one of new, read, archived",
    );
  }

  const contact = await Contact.findById(id);
  if (!contact) {
    throw new AppError(httpStatus.NOT_FOUND, "Contact message not found");
  }

  if (status === "new") {
    // Moving back to new hands the message to nobody.
    contact.status = status;
    contact.handledBy = null;
    contact.handledAt = null;
  } else {
    contact.status = status;
    contact.handledAt = new Date();

    if (adminEmail) {
      const admin = await User.findOne({ email: adminEmail });
      if (admin) contact.handledBy = admin._id;
    }
  }

  const result = await contact.save();

  await adminLogService.record({
    adminEmail,
    action: status === "archived" ? "contact.archive" : "contact.status",
    targetType: "contact",
    targetId: String(contact._id),
    summary: `Marked contact message from ${contact.firstName} ${contact.lastName} as ${status}`,
    meta: { status },
  });

  return result;
};

export const contactService = {
  create,
  getAll,
  getSingle,
  updateStatus,
};
