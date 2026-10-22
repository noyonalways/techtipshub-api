import { Document, Types } from "mongoose";

export interface IView extends Document {
  /** Signed-in viewer's account. Absent for guests, who are keyed by `visitorKey`. */
  user?: Types.ObjectId;
  post: Types.ObjectId;
  /**
   * Unique reader key per post: `user:<accountId>` for signed-in readers, or
   * `guest:<hash>` where the hash mixes a random cookie id with the IP address
   * and user agent. Never stores an IP address itself.
   */
  visitorKey: string;
  viewedAt: Date;
}
