import { model, Schema } from "mongoose";
import { IView } from "./view.interface";

const viewSchema = new Schema<IView>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    post: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: [true, "Post Id is required"],
    },
    visitorKey: {
      type: String,
      required: [true, "visitorKey is required"],
      trim: true,
    },
    viewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// One view per reader per post.
//
// Every record carries a `visitorKey`: the account id for signed-in readers and
// the pseudonymous guest hash otherwise. That single field is what the unique
// index enforces. (`user` is kept only to browse views by account; it is
// deliberately not uniquely indexed, because the pre-existing index of that
// name on `{post, user}` has to stay compatible for guest rows that have no
// user.)
viewSchema.index({ post: 1, visitorKey: 1 }, { unique: true });

const View = model<IView>("View", viewSchema);

export default View;
