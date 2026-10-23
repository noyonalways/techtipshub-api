import { model, Schema, Types } from "mongoose";

export type TContactStatus = "new" | "read" | "archived";

export const CONTACT_STATUSES: TContactStatus[] = ["new", "read", "archived"];

export interface IContact {
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  message: string;
  status: TContactStatus;
  handledBy?: Types.ObjectId | null;
  handledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const contactSchema = new Schema<IContact>(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
    },
    message: {
      type: String,
      required: [true, "Message is required"],
    },
    status: {
      type: String,
      enum: {
        values: CONTACT_STATUSES,
        message: "{VALUE} is not a valid status",
      },
      default: "new",
    },
    handledBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    handledAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

contactSchema.index({ status: 1, createdAt: -1 });

const Contact = model<IContact>("Contact", contactSchema);

export default Contact;
