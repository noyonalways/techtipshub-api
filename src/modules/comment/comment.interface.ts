import { Document, Types } from "mongoose";

export interface IComment extends Document {
  /** Stored DB field name for the referenced blog. */
  post: Types.ObjectId;
  user: Types.ObjectId;
  content: string;
  isDeleted: boolean;
  images?: string[];
  upVotes?: number;
  downVotes?: number;
  createdAt: Date;
  updatedAt: Date;
}
