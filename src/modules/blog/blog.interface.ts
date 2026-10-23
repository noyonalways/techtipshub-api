import { Document, Types } from "mongoose";

export type TContentType = "html" | "markdown" | "text";

export interface IBlog extends Document {
  author: Types.ObjectId;
  title: string;
  slug: string;
  contentType: TContentType;
  content: string;
  coverImage: string;
  images: string[];
  category: Types.ObjectId;
  tags: string[];
  upVotes: number;
  downVotes: number;
  totalViews: number;
  totalComments: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
