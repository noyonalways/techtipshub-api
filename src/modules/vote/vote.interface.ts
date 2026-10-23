import { Document, Types } from "mongoose";

export type TVoteType = "upvote" | "downvote";

export interface IVote extends Document {
  user: Types.ObjectId;
  /** Stored DB field name for the referenced blog. */
  post: Types.ObjectId;
  type: TVoteType;
}
