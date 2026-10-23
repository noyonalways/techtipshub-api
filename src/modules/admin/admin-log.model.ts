import { model, Schema, Types } from "mongoose";

export interface IAdminLog {
  admin: Types.ObjectId;
  action: string;
  targetType: string;
  targetId?: string;
  summary: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const adminLogSchema = new Schema<IAdminLog>(
  {
    admin: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    targetType: {
      type: String,
      required: true,
      trim: true,
    },
    targetId: {
      type: String,
      trim: true,
    },
    summary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    meta: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true },
);

adminLogSchema.index({ createdAt: -1 });

const AdminLog = model<IAdminLog>("AdminLog", adminLogSchema);

export default AdminLog;
