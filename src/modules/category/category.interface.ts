import { Document } from "mongoose";

export interface ICategory extends Document {
  name: string;
  description?: string;
  /** Stored DB field name for the category's blog count. */
  postCount: number;
  blogCount: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
