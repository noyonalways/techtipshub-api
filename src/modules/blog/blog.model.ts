import { model, Schema } from "mongoose";
import { BlogContentType } from "./blog.constant";
import { IBlog } from "./blog.interface";

const blogSchema = new Schema<IBlog>(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Author Id is require"],
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    contentType: {
      type: String,
      enum: {
        values: BlogContentType,
        message: "{VALUE} is not a valid content type",
      },
      required: [true, "Content type is required"],
    },
    content: {
      type: String,
      required: [true, "Content is required"],
    },
    coverImage: {
      type: String,
      required: [true, "Image is required"],
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category Id is required"],
    },
    images: {
      type: [String],
      default: [],
    },
    tags: {
      type: [String],
      required: [true, "Tags are required"],
      default: [],
    },
    upVotes: {
      type: Number,
      default: 0,
    },
    downVotes: {
      type: Number,
      default: 0,
    },
    totalComments: {
      type: Number,
      default: 0,
    },
    totalViews: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

blogSchema.pre("find", function (next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

blogSchema.pre("findOne", function (next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

// Model name and collection are the stored DB identifiers: keep them as "Post"
// and "posts" so existing documents stay reachable.
const Blog = model<IBlog>("Post", blogSchema, "posts");

export default Blog;
