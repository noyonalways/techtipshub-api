import httpStatus from "http-status";
import { JwtPayload } from "jsonwebtoken";
import mongoose, { Types } from "mongoose";
import { escapeRegex, parseSearchTerms, QueryBuilder } from "../../builder";
import { AppError } from "../../errors";
import { deleteBlogEmailConfirmation, sendEmail } from "../../utils";
import { adminLogService } from "../admin/admin-log.service";
import Category from "../category/category.model";
import { IComment } from "../comment/comment.interface";
import Comment from "../comment/comment.model";
import Follower from "../follower/follower.model";
import User from "../user/user.model";
import { recordView } from "../view/view.service";
import View from "../view/view.model";
import Vote from "../vote/vote.model";
import { blogSearchableFields } from "./blog.constant";
import { IBlog } from "./blog.interface";
import Blog from "./blog.model";
import { generateUniqueSlug } from "./blog.utils";

const create = async (userData: JwtPayload, payload: IBlog) => {
  const user = await User.findOne({ email: userData.email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const category = await Category.findById(payload.category);
  if (!category) {
    throw new AppError(httpStatus.NOT_FOUND, "Category not found");
  }

  payload.author = user._id;
  payload.category = category._id;

  // Generate unique slug
  payload.slug = await generateUniqueSlug(payload.title);

  const session = await Blog.startSession();

  try {
    // Start transaction
    session.startTransaction();

    // Create a new blog within the transaction
    const newBlog = await Blog.create([{ ...payload }], { session });
    if (newBlog.length < 0) {
      throw new AppError(httpStatus.BAD_REQUEST, "Failed to create blog");
    }

    // Increment postCount of the category by 1
    const updatedCategory = await Category.findByIdAndUpdate(
      category._id,
      { $inc: { postCount: 1 } }, // Increment the postCount field by 1
      { session, new: true }, // Pass session and return the updated category
    );
    if (!updatedCategory) {
      throw new AppError(httpStatus.BAD_REQUEST, "Failed to update category");
    }

    // Increment the author's total blog count by 1
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $inc: { totalPosts: 1 } }, // Increment the totalPosts field by 1
      { session, new: true }, // Pass session and return the updated category
    );

    if (!updatedUser) {
      throw new AppError(httpStatus.BAD_REQUEST, "Failed to update User");
    }

    // Commit the transaction and end the session
    await session.commitTransaction();
    await session.endSession();

    return (
      await newBlog[0].populate({
        path: "author",
        select: "fullName email username profilePicture",
      })
    ).populate({
      path: "category",
      select: "name description postCount",
    });
  } catch (err) {
    // Abort transaction in case of an error
    await session.abortTransaction();
    await session.endSession();
    throw err;
  }
};

// get all blogs (for anyone to see title small part of description, category, views, upvote, downvote etc)
const getAll = async (query: Record<string, unknown>) => {
  const blogQuery = new QueryBuilder(
    Blog.find({}).populate("author").populate("category"),
    query,
  ).search(blogSearchableFields);

  // Await the filter() method
  await blogQuery.filter();

  // Now you can safely call sort, paginate, and fields
  blogQuery.sort().paginate().fields();

  const result = await blogQuery.modelQuery; // Await the results here
  const meta = await blogQuery.countTotal();

  return { result, meta };
};

/**
 * Article lifecycle in the admin table. The Blog model only tracks
 * `isDeleted`: a document that exists and is not deleted is live (`status`
 * says "published", the word the public feed uses), and one that is deleted
 * sits in `/admin/blogs/trash` until it is restored.
 */
const ADMIN_BLOG_STATUSES = ["published"] as const;

// Fields the admin table may sort by. Anything else is a 400, so a typo cannot
// silently fall back to an unindexed sort.
const ADMIN_BLOG_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "title",
  "slug",
  "totalViews",
  "totalComments",
  "upVotes",
  "downVotes",
] as const;

/**
 * Admin article list: every article that is not in the trash, with the same
 * populated author/category shape the public list returns.
 */
const getAdminList = async (query: Record<string, unknown>) => {
  // Whitelisted keys only: QueryBuilder.filter() splices the query object into
  // the Mongo filter, so unvetted keys could carry operators.
  const parsed: Record<string, unknown> = {};

  if (typeof query.searchTerm === "string" && query.searchTerm.trim())
    parsed.searchTerm = query.searchTerm;
  if (typeof query.page === "string" && query.page) parsed.page = query.page;
  if (typeof query.limit === "string" && query.limit)
    parsed.limit = query.limit;

  const sort = typeof query.sort === "string" ? query.sort.trim() : "";
  if (sort) {
    const fields = sort.split(",").map((part) => part.trim());
    const allowed = new Set<string>([...ADMIN_BLOG_SORT_FIELDS, "_id"]);

    for (const field of fields) {
      const name = field.replace(/^[-+]/, "");
      if (!allowed.has(name)) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Invalid sort field "${name}". Allowed: ${ADMIN_BLOG_SORT_FIELDS.join(", ")}`,
        );
      }
    }

    parsed.sort = fields.join(",");
  }

  // The list holds live articles only; deleted ones are the trash endpoint's
  // job. `status` is the panel's "publishing status" control, whose only value
  // this model has is `published`, so anything else is a 400 rather than a
  // silently empty table.
  const status = typeof query.status === "string" ? query.status.trim() : "";
  if (
    status &&
    !ADMIN_BLOG_STATUSES.includes(status.toLowerCase() as "published")
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `status must be ${ADMIN_BLOG_STATUSES.join(" or ")}. Deleted articles are listed at /admin/blogs/trash`,
    );
  }

  // `category` takes the Mongo id, or a category name for convenience.
  const filter: Record<string, unknown> = { isDeleted: { $ne: true } };
  const category =
    typeof query.category === "string" ? query.category.trim() : "";
  if (category) {
    if (/^[a-f\d]{24}$/i.test(category)) {
      filter.category = new Types.ObjectId(category);
    } else {
      const foundCategory = await Category.findOne({
        name: {
          $regex: `^${escapeRegex(category)}$`,
          $options: "i",
        },
      }).select("_id");

      if (!foundCategory) {
        // No category carries that name, so no article can match it.
        return {
          result: [],
          meta: {
            page: Math.max(1, Math.trunc(Number(query.page)) || 1),
            limit: Math.max(1, Math.trunc(Number(query.limit)) || 10),
            total: 0,
            totalPages: 0,
          },
        };
      }

      filter.category = foundCategory._id;
    }
  }

  // `author` is a member id only: a name would be ambiguous and a slug must
  // not land on an ObjectId cast error.
  const rawAuthor = typeof query.author === "string" ? query.author.trim() : "";
  const author = /^[a-f\d]{24}$/i.test(rawAuthor) ? rawAuthor : "";
  if (rawAuthor && !author) {
    throw new AppError(httpStatus.BAD_REQUEST, "author must be a member id");
  }
  if (author) {
    filter.author = new Types.ObjectId(author);
  }

  // Title/slug live on the document; the author's name needs a lookup.
  // Matching ids for terms that hit a member keeps one query and one count.
  // Every term has to match (AND), on the article or on its author (OR).
  const searchTerms = parseSearchTerms(parsed.searchTerm);
  if (searchTerms.length > 0) {
    const authorFilters = await Promise.all(
      searchTerms.map((term) => {
        const escaped = escapeRegex(term);
        const regex = escaped.length >= 3 ? `^${escaped}` : escaped;
        const match = { $regex: regex, $options: "i" };

        return User.find({
          isDeleted: { $ne: true },
          $or: [{ fullName: match }, { username: match }],
        })
          .select("_id")
          .limit(100);
      }),
    );

    filter.$and = searchTerms.map((term, index) => {
      const escaped = escapeRegex(term);
      const regex = escaped.length >= 3 ? `^${escaped}` : escaped;
      const match = { $regex: regex, $options: "i" };

      const authorIds = authorFilters[index].map((member) => member._id);

      return {
        $or: [
          { title: match },
          { slug: match },
          ...(authorIds.length > 0 ? [{ author: { $in: authorIds } }] : []),
        ],
      };
    });

    // `searchTerm` is not a column; the conditions above replace it.
    delete parsed.searchTerm;
  }

  const blogQuery = new QueryBuilder(
    Blog.find(filter).populate("author").populate("category"),
    parsed,
  );

  if (parsed.sort) {
    blogQuery.sort();
  } else {
    blogQuery.sortBy("-createdAt,-_id");
  }

  blogQuery.paginate().fields();

  const result = await blogQuery.modelQuery;
  const meta = await blogQuery.countTotal();

  return { result, meta };
};

// get following users blogs
const getFollowingUsersBlogs = async (
  userData: JwtPayload,
  query: Record<string, unknown>,
) => {
  // Step 1: Find the current user by their email
  const user = await User.findOne({ email: userData.email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // Step 2: Find the list of users that the current user is following
  const following = await Follower.find({ follower: user._id }).select(
    "following",
  );

  if (!following || following.length === 0) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "You are not following any users.",
    );
  }

  // Step 3: Extract the user IDs of those being followed
  const followingUserIds = following.map((f) => f.following);

  // Step 4: Query the blogs where the author is in the following list
  const blogQuery = new QueryBuilder(
    Blog.find({
      author: { $in: followingUserIds },
    })
      .populate("author")
      .populate("category"),
    query,
  ).search(blogSearchableFields);

  // Await the filter() method
  await blogQuery.filter();

  // Now you can safely call sort, paginate, and fields
  blogQuery.sort().paginate().fields();

  const result = await blogQuery.modelQuery; // Await the results here
  const meta = await blogQuery.countTotal();

  return { result, meta };
};

// get current logged in user all blogs
const getLoggedInUserBlogs = async (
  userData: JwtPayload,
  query: Record<string, unknown>,
) => {
  const user = await User.findOne({ email: userData.email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const blogQuery = new QueryBuilder(
    Blog.find({ author: user._id, isDeleted: { $ne: true } })
      .populate("author")
      .populate("category"),
    query,
  ).search(blogSearchableFields);

  // Await the filter() method
  await blogQuery.filter();

  // Now you can safely call sort, paginate, and fields
  blogQuery.sort().paginate().fields();

  const result = await blogQuery.modelQuery; // Await the results here
  const meta = await blogQuery.countTotal();

  return { result, meta };
};

const getBlogByProperty = async (key: string, value: string) => {
  let blog;

  if (key === "_id") {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid blog Id");
    }
    blog = await Blog.findById(value).populate("author").populate({
      path: "category",
      select: "name description postCount",
    });
  } else {
    blog = await Blog.findOne({ [key]: value })
      .populate("author")
      .populate({
        path: "category",
        select: "name description postCount",
      });
  }

  if (!blog) {
    throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
  }

  return blog;
};

// get a single blog by slug.
// Guests get a preview: the article body is withheld and `isLocked` is true.
// Logged-in users get the full article and a view is recorded for them.
const getSingleBlog = async (
  userData: JwtPayload | undefined,
  slug: string,
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Fetch the blog by its slug
    const blog = await Blog.findOne({ slug })
      .populate({
        path: "author",
      })
      .populate({
        path: "category",
        select: "name description postCount",
      })
      .session(session);

    if (!blog) {
      throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
    }

    // Guest visitors can see everything but the article body
    if (!userData?.email) {
      await session.commitTransaction();
      session.endSession();

      const preview = blog.toObject() as Partial<IBlog> & {
        isLocked?: boolean;
      };
      preview.isLocked = true;
      delete preview.content;

      return preview;
    }

    // Get the current logged-in user
    const currentLoggedInUser = await User.findOne({
      email: userData.email,
    }).session(session);

    if (!currentLoggedInUser) {
      throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    // Record the view (once per reader, never for the author) and return the
    // reconciled total. This runs outside the read transaction so a concurrent
    // duplicate view can never abort the article fetch itself.
    const totalViews = await recordView(slug, { user: userData });

    // Commit transaction and return the blog
    await session.commitTransaction();
    session.endSession();

    return {
      ...blog.toObject(),
      totalViews: totalViews ?? blog.totalViews,
      isLocked: false,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// vote on blog
const voteOnBlog = async (
  userData: JwtPayload,
  blogId: string,
  voteType: "upvote" | "downvote",
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validate the voteType
    if (!["upvote", "downvote"].includes(voteType)) {
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid vote type");
    }

    // Get the current logged-in user
    const currentLoggedInUser = await User.findOne({
      email: userData.email,
    }).session(session);

    if (!currentLoggedInUser) {
      throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    // Fetch the blog by its ID
    const blog = await Blog.findById(blogId).session(session);
    if (!blog) {
      throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
    }

    // Ensure the user is not the author of the blog (skip author's votes if necessary)
    if (blog.author.equals(currentLoggedInUser._id)) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Author cannot vote on their own blog",
      );
    }

    // Find if the user has already voted on this blog
    const existingVote = await Vote.findOne({
      // "post" is the stored DB field on votes, not the concept name.
      post: blog._id,
      user: currentLoggedInUser._id,
    }).session(session);

    if (existingVote) {
      if (existingVote.type === voteType) {
        // If the user clicks the same vote type (toggle functionality)
        await existingVote.deleteOne({ session });

        if (voteType === "upvote") {
          blog.upVotes -= 1;
        } else {
          blog.downVotes -= 1;
        }
      } else {
        // If the user is switching their vote (from upvote to downvote or vice versa)
        existingVote.type = voteType;
        await existingVote.save({ session });

        if (voteType === "upvote") {
          blog.upVotes += 1;
          blog.downVotes -= 1;
        } else {
          blog.downVotes += 1;
          blog.upVotes -= 1;
        }
      }
    } else {
      // If no existing vote, create a new vote
      await Vote.create(
        [
          {
            user: currentLoggedInUser._id,
            // "post" is the stored DB field on votes, not the concept name.
            post: blog._id,
            type: voteType,
          },
        ],
        { session },
      );

      // Increment upvotes or downvotes on the blog
      if (voteType === "upvote") {
        blog.upVotes += 1;
      } else {
        blog.downVotes += 1;
      }
    }

    // Save the blog after updating votes
    await blog.save({ session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    return blog; // Return the updated blog with vote counts
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// get vote status
const getVoteStatus = async (userData: JwtPayload, blogId: string) => {
  const user = await User.findOne({ email: userData.email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const blog = await Blog.findById(blogId);
  if (!blog) {
    throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
  }

  const existingVote = await Vote.findOne({
    // "post" is the stored DB field on votes, not the concept name.
    post: blog._id,
    user: user._id,
  });

  if (!existingVote) {
    throw new AppError(httpStatus.NOT_FOUND, "Not Voted yet!");
  }

  // If the user has voted, return the vote type and relevant metadata
  return {
    status: "Voted",
    voteType: existingVote.type, // "upvote" or "downvote"
    blogId: blog._id,
    userId: user._id,
  };
};

// comment on blog with transaction
const commentOnBlog = async (
  userData: JwtPayload,
  blogId: string,
  payload: IComment,
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Find the current logged-in user
    const currentLoggedInUser = await User.findOne({
      email: userData.email,
    }).session(session);

    if (!currentLoggedInUser) {
      throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    // Fetch the blog by its ID
    const blog = await Blog.findById(blogId).session(session);
    if (!blog) {
      throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
    }

    // Create a new comment
    const comment = await Comment.create(
      [
        {
          ...payload,
          user: currentLoggedInUser._id,
          // "post" is the stored DB field on comments, not the concept name.
          post: blog._id,
        },
      ],
      { session },
    );

    // Keep the stored counter equal to the number of visible comments rather
    // than incrementing blindly, so edits and removals can never drift it.
    // The count must join the transaction, or the new comment is not visible to
    // it and the counter is written back as zero.
    blog.totalComments = await Comment.countDocuments({
      // "post" is the stored DB field on comments, not the concept name.
      post: blog._id,
      isDeleted: { $ne: true },
    }).session(session);
    await blog.save({ session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // Find and populate the comment with specific fields from user and blog
    return await Comment.findById(comment[0]._id)
      .populate({
        path: "user",
        select: "fullName email profilePicture",
      })
      .populate({
        // "post" is the stored DB field on comments, not the concept name.
        path: "post",
        select: "title category slug",
      });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// get all comments by blog id
const getAllCommentsByBlogId = async (
  blogId: string,
  query: Record<string, unknown>,
) => {
  // Fetch the blog by its ID
  const blog = await Blog.findById(blogId);
  if (!blog) {
    throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
  }

  // Only visible comments: a soft-deleted comment stays in the collection for
  // moderation history, but it must not appear in the list or the count.
  const commentQuery = new QueryBuilder(
    Comment.find({
      // "post" is the stored DB field on comments, not the concept name.
      post: blog._id,
      isDeleted: { $ne: true },
    })
      .populate("user")
      .populate({
        // "post" is the stored DB field on comments, not the concept name.
        path: "post",
      }),
    query,
  );

  // Await the filter() method
  await commentQuery.filter();

  // Now you can safely call sort, paginate, and fields
  commentQuery.sort().paginate().fields();

  const result = await commentQuery.modelQuery; // Await the results here
  const meta = await commentQuery.countTotal();

  return { result, meta };
};

// get all blogs by user id
const getAllBlogsByUserId = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // The author's real article count is the source of truth for a profile, so it
  // cannot lag behind like the stored `user.totalPosts` counter did. Deleted
  // blogs are not on the list, so they must not be in its total either.
  const visibleFilter = { author: user._id, isDeleted: { $ne: true } };
  const total = await Blog.countDocuments(visibleFilter);

  const blogQuery = new QueryBuilder(
    Blog.find(visibleFilter).populate("author").populate("category"),
    query,
  ).search(blogSearchableFields);

  // Await the filter() method
  await blogQuery.filter();

  // Newest first: the default sort only applies when the caller doesn't ask
  // for something else, and `createdAt` alone can tie within one millisecond.
  if (!query.sort) {
    blogQuery.sortBy("-createdAt,-_id");
  } else {
    blogQuery.sort();
  }

  blogQuery.paginate().fields();

  const result = await blogQuery.modelQuery; // Await the results here
  const meta = await blogQuery.countTotal();
  meta.total = total;

  return { result, meta };
};

// delete blog by admin using id
const deleteBlogByAdminUsingId = async (
  id: string,
  payload: Record<string, string>,
  adminEmail?: string,
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Find the blog and populate the author with specific fields
    const blog = await Blog.findById(id)
      .populate({ path: "author", select: "fullName email" })
      .session(session);
    if (!blog) {
      throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
    }

    const author = await User.findByIdAndUpdate(blog?.author._id, {
      $inc: { totalPosts: -1 },
    }).session(session);

    if (!author) {
      throw new AppError(httpStatus.NOT_FOUND, "Author not found");
    }

    // Soft delete the blog
    blog.isDeleted = true;
    await blog.save({ session });

    // delete associated comments, views, and votes
    // "post" is the stored DB field on these collections, not the concept name.
    await Comment.deleteMany({ post: blog._id }, { session });
    await View.deleteMany({ post: blog._id }, { session });
    await Vote.deleteMany({ post: blog._id }, { session });
    await Category.findByIdAndUpdate(
      blog.category,
      {
        $inc: { postCount: -1 },
      },
      { session },
    );

    // Commit the transaction
    await session.commitTransaction();
    await session.endSession();

    await adminLogService.record({
      adminEmail,
      action: "article.delete",
      targetType: "blog",
      targetId: String(blog._id),
      summary: `Deleted article "${blog.title}"`,
      meta: { reason: payload.reason },
    });

    // Send email notification to the author
    await sendEmail({
      to: {
        name: author.fullName,
        address: author.email,
      },
      subject: "Your blog has been deleted",
      html: deleteBlogEmailConfirmation(blog.title, payload.reason),
      text: "Your blog has been deleted",
    });

    // eslint-disable-next-line no-console
    console.log("Blog soft-deleted, email sent successfully.");
  } catch (error) {
    // Abort the transaction in case of an error
    await session.abortTransaction();
    await session.endSession();
    throw error;
  }
};

// delete blog by user
const deleteBlogByUserUsingId = async (
  userData: JwtPayload,
  blogId: string,
) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const user = await User.findOneAndUpdate(
      { email: userData.email },
      { $inc: { totalPosts: -1 } },
    ).session(session);
    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    const blog = await Blog.findOne({ _id: blogId, author: user._id }).session(
      session,
    );
    if (!blog) {
      throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
    }

    // Soft delete the blog
    blog.isDeleted = true;
    const result = await blog.save({ session });

    // delete associated comments, views, and votes
    // "post" is the stored DB field on these collections, not the concept name.
    await Comment.deleteMany({ post: blog._id }, { session });
    await View.deleteMany({ post: blog._id }, { session });
    await Vote.deleteMany({ post: blog._id }, { session });
    await Category.findByIdAndUpdate(
      blog.category,
      {
        $inc: { postCount: -1 },
      },
      { session },
    );

    // Commit the transaction
    await session.commitTransaction();
    await session.endSession();

    // Send email notification to the author
    // await sendEmail({
    //   to: {
    //     name: user.fullName,
    //     address: user.email,
    //   },
    //   subject: "Your blog has been deleted",
    //   html: deleteBlogEmailConfirmation(blog.title, "User deletion"),
    //   text: "Your blog has been deleted",
    // });

    return result;
  } catch (err) {
    await session.abortTransaction();
    await session.endSession();
    throw err;
  }
};

// update blog by user using blog id
const updateBlogByUserUsingId = async (
  userData: JwtPayload,
  blogId: string,
  payload: IBlog,
) => {
  const user = await User.findOne({ email: userData.email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // Generate unique slug
  payload.slug = await generateUniqueSlug(payload.title);

  const blog = await Blog.findOneAndUpdate(
    { _id: blogId, author: user._id },
    { ...payload },
    { new: true, runValidators: true },
  );

  if (!blog) {
    throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
  }

  return blog;
};

const updateBlogByAdmin = async (
  blogId: string,
  payload: IBlog & { userId: string },
) => {
  const user = await User.findById(payload.userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (payload.title) {
    // Generate unique slug
    payload.slug = await generateUniqueSlug(payload.title);
  }

  const updatedBlog = await Blog.findByIdAndUpdate(
    blogId,
    { ...payload },
    { new: true, runValidators: true },
  );
  if (!updatedBlog) {
    throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
  }

  return updatedBlog;
};

const getDeletedBlogs = async (rawQuery: Record<string, unknown>) => {
  const page = Math.max(1, Math.trunc(Number(rawQuery.page)) || 1);
  const rawLimit = Math.trunc(Number(rawQuery.limit));
  const limit = rawLimit > 0 ? Math.min(100, rawLimit) : 10;

  // Whitelisted keys only: `searchTerm` here is expanded into a filter, and
  // nothing else from the query string reaches Mongo.
  const searchTerms = parseSearchTerms(rawQuery.searchTerm);
  const search = searchTerms.map((term) => {
    const escaped = escapeRegex(term);
    const regex = escaped.length >= 3 ? `^${escaped}` : escaped;
    const match = { $regex: regex, $options: "i" };

    return { $or: [{ title: match }, { slug: match }] };
  });

  // Mongoose 8.24 offers no public way past query middleware. The
  // `pre("find")` hook merges its `isDeleted: { $ne: true }` into an `$and`,
  // and `cast()` leaves unknown operators such as `$nor` untouched, so
  // `$nor: [{ isDeleted: true }]` survives next to the hook filter and narrows
  // the results to deleted rows only. The search joins the same `$and`; a
  // separate `.find()` would replace `$nor` and resurrect live articles.
  const [result, total] = await Promise.all([
    Blog.find({
      $nor: [{ isDeleted: true }],
      ...(search.length ? { $and: search } : {}),
    })
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-content -__v")
      .populate({ path: "author", select: "fullName username" })
      .lean(),
    // countDocuments runs no find hook, so it counts only deleted rows.
    Blog.countDocuments({
      isDeleted: true,
      ...(search.length ? { $and: search } : {}),
    }),
  ]);

  return {
    result,
    meta: {
      limit,
      page,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const restoreBlog = async (blogId: string, adminEmail?: string) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // The find hook hides deleted rows, so confirm the raw state first.
    const raw = await Blog.collection.findOne({
      _id: new Types.ObjectId(blogId),
    });
    if (!raw) {
      throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
    }

    if (raw.isDeleted !== true) {
      throw new AppError(httpStatus.BAD_REQUEST, "Blog is not deleted");
    }

    const blog = await Blog.findByIdAndUpdate(
      blogId,
      { isDeleted: false },
      { session, new: true, runValidators: true },
    );
    if (!blog) {
      throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
    }

    await User.findByIdAndUpdate(
      raw.author,
      { $inc: { totalPosts: 1 } },
      { session },
    );
    await Category.findByIdAndUpdate(
      raw.category,
      { $inc: { postCount: 1 } },
      { session },
    );

    await session.commitTransaction();

    await adminLogService.record({
      adminEmail,
      action: "article.restore",
      targetType: "blog",
      targetId: String(blog._id),
      summary: `Restored article "${blog.title}"`,
    });

    return blog.populate({ path: "author", select: "fullName username" });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

export const blogService = {
  create,
  getAll,
  getLoggedInUserBlogs,
  getSingleBlog,
  getBlogByProperty,
  voteOnBlog,
  commentOnBlog,
  getAllCommentsByBlogId,
  getAllBlogsByUserId,
  getVoteStatus,
  getFollowingUsersBlogs,
  deleteBlogByAdminUsingId,
  deleteBlogByUserUsingId,
  updateBlogByUserUsingId,
  updateBlogByAdmin,
  getAdminList,
  getDeletedBlogs,
  restoreBlog,
};
