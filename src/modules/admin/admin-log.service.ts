import User from "../user/user.model";
import AdminLog from "./admin-log.model";

export type TAdminLogInput = {
  adminEmail?: string;
  action: string;
  targetType: string;
  targetId?: string;
  summary: string;
  meta?: Record<string, unknown>;
};

// Logging must never break the action it records, so every failure is swallowed.
const record = async (input: TAdminLogInput): Promise<void> => {
  try {
    if (!input.adminEmail) return;

    const admin = await User.findOne({ email: input.adminEmail });
    if (!admin) return;

    await AdminLog.create({
      admin: admin._id,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      summary: input.summary.slice(0, 120),
      meta: input.meta,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("Failed to record admin log:", error);
  }
};

export const adminLogService = { record };
