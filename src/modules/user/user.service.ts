import httpStatus from "http-status";
import { JwtPayload } from "jsonwebtoken";
import mongoose, { FilterQuery } from "mongoose";
import { buildSearchFilter, QueryBuilder } from "../../builder";
import { USER_ROLE, USER_STATUS } from "../../constant";
import { AppError } from "../../errors";
import { adminLogService } from "../admin/admin-log.service";
import Comment from "../comment/comment.model";
import Follower from "../follower/follower.model";
import Blog from "../blog/blog.model";
import View from "../view/view.model";
import Vote from "../vote/vote.model";
import { IUser, TSocialLink } from "./user.interface";
import User from "./user.model";

// Values the admin panel may filter/sort members by. Anything else is a 400.
const USER_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "fullName",
  "username",
  "email",
  "role",
  "status",
  "totalPosts",
] as const;

/** `page`/`limit` as numbers, clamped to sane bounds (page >= 1, 1..100). */
const pageParams = (rawQuery: Record<string, unknown>) => {
  const page = Math.max(1, Math.trunc(Number(rawQuery.page)) || 1);
  const rawLimit = Math.trunc(Number(rawQuery.limit));
  const limit = rawLimit > 0 ? Math.min(100, rawLimit) : 10;

  return { page, limit };
};

/** Validate `page`, `limit` and `sort` for the admin member lists. */
const parseListQuery = (
  rawQuery: Record<string, unknown>,
  { defaultSort, maxLimit }: { defaultSort: string; maxLimit: number },
) => {
  const parsed: Record<string, unknown> = {};

  if (typeof rawQuery.page === "string" && rawQuery.page)
    parsed.page = rawQuery.page;
  if (typeof rawQuery.limit === "string" && rawQuery.limit)
    parsed.limit = rawQuery.limit;
  if (typeof rawQuery.fields === "string" && rawQuery.fields)
    parsed.fields = rawQuery.fields;

  const sort = typeof rawQuery.sort === "string" ? rawQuery.sort.trim() : "";
  if (sort) {
    const fields = sort.split(",").map((part) => part.trim());
    const allowed = new Set<string>([...USER_SORT_FIELDS, "_id"]);

    for (const field of fields) {
      const name = field.replace(/^[-+]/, "");
      if (!allowed.has(name)) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Invalid sort field "${name}". Allowed: ${USER_SORT_FIELDS.join(", ")}`,
        );
      }
    }

    parsed.sort = fields.join(",");
  } else {
    parsed.sort = defaultSort;
  }

  // Cap the page size like the other admin lists, so one request cannot pull
  // the whole member collection.
  const limit = Number(parsed.limit);
  if (Number.isFinite(limit) && limit > maxLimit)
    parsed.limit = String(maxLimit);

  return parsed;
};

const parseEnumParam = (
  raw: unknown,
  allowed: readonly string[],
  label: string,
  { allowAll = false }: { allowAll?: boolean } = {},
) => {
  if (raw === undefined || raw === "") return undefined;

  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (allowAll && value === "all") return undefined;

  const match = allowed.find((option) => option.toLowerCase() === value);

  if (!match) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `${label} must be one of ${allowAll ? ["all", ...allowed].join(", ") : allowed.join(", ")}`,
    );
  }

  return match;
};

const USER_ROLE_VALUES = [USER_ROLE.ADMIN, USER_ROLE.USER] as const;
const USER_STATUS_VALUES = [USER_STATUS.ACTIVE, USER_STATUS.BLOCKED] as const;

// get all users
const getAllUsers = async (query: Record<string, unknown>) => {
  // Whitelisted keys only: QueryBuilder.filter() splices the query object into
  // the Mongo filter, so unvetted keys could carry operators.
  const parsed = parseListQuery(query, {
    defaultSort: "-createdAt,-_id",
    maxLimit: 100,
  });

  // Header status/role tabs, e.g. `?status=Blocked` / `?role=Admin`. "all" is
  // the panel's way of saying "no filter", so it is accepted and ignored, and
  // case is normalised: `?role=admin` would otherwise reach Mongo with the
  // wrong case through filter() and return an empty page.
  const status = parseEnumParam(query.status, USER_STATUS_VALUES, "Status", {
    allowAll: true,
  });
  if (status) parsed.status = status;

  const role = parseEnumParam(query.role, USER_ROLE_VALUES, "Role", {
    allowAll: true,
  });
  if (role) parsed.role = role;

  // `searchTerm` filters the fields below and also matches on the stored
  // role/status values, so searching "Blocked" or "Admin" narrows the list.
  const userQuery = new QueryBuilder(User.find({}), parsed).search(
    ["fullName", "email", "username"],
    ["status", "role"],
  );

  await userQuery.filter();

  userQuery.sort().paginate().fields();

  const result = await userQuery.modelQuery;
  const meta = await userQuery.countTotal();

  return { result, meta };
};

// get single user by username
const getSingleUserByUsername = async (username: string) => {
  const user = await User.findOne({ username });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return user;
};

// update user profile
const updateProfile = async (userData: JwtPayload, payload: IUser) => {
  const updatedUser = await User.findOneAndUpdate(
    { email: userData.email },
    payload,
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updatedUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return updatedUser;
};

// update user profile social links
const updateSocialLinks = async (
  userData: JwtPayload,
  payload: TSocialLink[],
) => {
  const updatedUser = await User.findOneAndUpdate(
    { email: userData.email },
    payload,
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updatedUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return updatedUser;
};

// block a user (admin only)
const blockUser = async (id: string, adminEmail?: string) => {
  const user = await User.findById(id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.status === USER_STATUS.BLOCKED) {
    throw new AppError(httpStatus.BAD_REQUEST, "User is already Blocked");
  }

  const result = await User.findByIdAndUpdate(
    id,
    { status: USER_STATUS.BLOCKED },
    { new: true, runValidators: true },
  );

  await adminLogService.record({
    adminEmail,
    action: "user.block",
    targetType: "user",
    targetId: id,
    summary: `Blocked ${user.fullName} (@${user.username})`,
  });

  return result;
};

// unblock a user (admin only)
const unBlockUser = async (id: string, adminEmail?: string) => {
  const user = await User.findById(id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.status === USER_STATUS.ACTIVE) {
    throw new AppError(httpStatus.BAD_REQUEST, "User is already Active");
  }

  const result = await User.findByIdAndUpdate(
    id,
    { status: USER_STATUS.ACTIVE },
    { new: true, runValidators: true },
  );

  await adminLogService.record({
    adminEmail,
    action: "user.unblock",
    targetType: "user",
    targetId: id,
    summary: `Unblocked ${user.fullName} (@${user.username})`,
  });

  return result;
};

// make a user to admin (admin only)
const makeAdmin = async (id: string, adminEmail?: string) => {
  const user = await User.findById(id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, "User is already deleted");
  }

  if (user.status === USER_STATUS.BLOCKED) {
    throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
  }

  if (user.role === USER_ROLE.ADMIN) {
    throw new AppError(httpStatus.BAD_REQUEST, "User is already an admin");
  }

  const result = await User.findByIdAndUpdate(
    id,
    { role: USER_ROLE.ADMIN },
    { new: true, runValidators: true },
  );

  await adminLogService.record({
    adminEmail,
    action: "user.make_admin",
    targetType: "user",
    targetId: id,
    summary: `Made ${user.fullName} (@${user.username}) an admin`,
  });

  return result;
};

// delete user account (admin only)
const deleteUserAccount = async (id: string, adminEmail?: string) => {
  const user = await User.findById(id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, "User is already deleted");
  }

  if (user.role === USER_ROLE.ADMIN) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Admin users cannot delete accounts",
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 1. Delete user's blogs
    await Blog.deleteMany({ author: user._id }, { session });

    // 2. Delete user's comments and decrement totalComments for each blog
    // (`comment.post` is the stored field name.)
    const userComments = await Comment.find({ user: user._id });
    for (const comment of userComments) {
      await Blog.findByIdAndUpdate(
        comment.post,
        { $inc: { totalComments: -1 } },
        { session },
      );
    }
    await Comment.deleteMany({ user: user._id }, { session });

    // 3. Delete user's views and decrement totalViews for each blog
    // (`view.post` is the stored field name.)
    const userViews = await View.find({ user: user._id });
    for (const view of userViews) {
      await Blog.findByIdAndUpdate(
        view.post,
        { $inc: { totalViews: -1 } },
        { session },
      );
    }
    await View.deleteMany({ user: user._id }, { session });

    // 4. Delete user's votes and decrement upVotes or downVotes for each blog
    // (`vote.post` is the stored field name.)
    const userVotes = await Vote.find({ user: user._id });
    for (const vote of userVotes) {
      if (vote.type === "upvote") {
        await Blog.findByIdAndUpdate(
          vote.post,
          { $inc: { upVotes: -1 } },
          { session },
        );
      } else if (vote.type === "downvote") {
        await Blog.findByIdAndUpdate(
          vote.post,
          { $inc: { downVotes: -1 } },
          { session },
        );
      }
    }
    await Vote.deleteMany({ user: user._id }, { session });

    // 5. Delete user's followers and following relationships
    await Follower.deleteMany({ follower: user._id }, { session });
    await Follower.deleteMany({ following: user._id }, { session });

    // 6. Mark the user as deleted
    user.isDeleted = true;
    await user.save({ session });

    await session.commitTransaction();
    session.endSession();
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }

  await adminLogService.record({
    adminEmail,
    action: "user.delete",
    targetType: "user",
    targetId: id,
    summary: `Deleted account ${user.fullName} (@${user.username})`,
  });
};

const getDeletedUsers = async (rawQuery: Record<string, unknown>) => {
  const { page, limit } = pageParams(rawQuery);
  // Same visible columns as the member table: name, handle and address.
  const search = buildSearchFilter(rawQuery.searchTerm, {
    leaf: (escaped) => {
      const match = {
        $regex: escaped.length >= 3 ? `^${escaped}` : escaped,
        $options: "i",
      };

      return {
        $or: [{ fullName: match }, { username: match }, { email: match }],
      };
    },
  });

  // Mongoose 8.24 has no public way past query middleware. `cast()` leaves
  // unknown operators such as `$nor` untouched, so alongside the hook's own
  // `isDeleted: { $ne: true }` this narrows the list to deleted members only.
  // The search joins the same filter: a separate `.where()` would replace
  // `$nor` and quietly bring live members back into the trash.
  const visibleFilter = {
    $and: [{ $nor: [{ isDeleted: true }] }, ...(search ? [search] : [])],
  } as FilterQuery<IUser>;

  const [result, total] = await Promise.all([
    User.find(visibleFilter)
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        "fullName username email profilePicture role status createdAt updatedAt totalPosts",
      )
      .lean(),
    // countDocuments runs no find hook, so it counts only deleted rows.
    User.countDocuments({
      $and: [{ isDeleted: true }, ...(search ? [search] : [])],
    } as FilterQuery<IUser>),
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

const restoreUser = async (id: string, adminEmail?: string) => {
  // The find hook hides deleted members, so read the raw document.
  const raw = await User.collection.findOne({
    _id: new mongoose.Types.ObjectId(id),
  });
  if (!raw) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (raw.isDeleted !== true) {
    throw new AppError(httpStatus.BAD_REQUEST, "User is not deleted");
  }

  // Only the flag is flipped: deleting an account purges its blogs, comments,
  // views and votes, so a restored member comes back with an empty profile.
  const result = await User.findByIdAndUpdate(
    id,
    { isDeleted: false },
    { new: true, runValidators: true },
  );

  await adminLogService.record({
    adminEmail,
    action: "user.restore",
    targetType: "user",
    targetId: id,
    summary: `Restored account ${raw.fullName} (@${raw.username})`,
  });

  return result;
};

// Follow a user with transaction
const followUser = async (userData: JwtPayload, userIdToFollow: string) => {
  const session = await mongoose.startSession(); // Start a session

  try {
    session.startTransaction(); // Start a transaction

    // Find current logged-in user
    const currentLoggedInUser = await User.findOne({
      email: userData.email,
    }).session(session);

    if (!currentLoggedInUser) {
      throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    // Find the user to follow
    const userToFollow = await User.findById(userIdToFollow).session(session);
    if (!userToFollow) {
      throw new AppError(httpStatus.NOT_FOUND, "User to follow not found");
    }

    // Prevent self-following
    if (currentLoggedInUser._id.equals(userToFollow._id)) {
      throw new AppError(httpStatus.BAD_REQUEST, "You cannot follow yourself");
    }

    // Check if the follow relationship already exists
    const existingFollow = await Follower.findOne({
      follower: currentLoggedInUser._id,
      following: userToFollow._id,
    }).session(session);

    if (existingFollow) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "You are already following this user",
      );
    }

    // Create a new follower relationship
    await Follower.create(
      [
        {
          follower: currentLoggedInUser._id,
          following: userToFollow._id,
          followedAt: new Date(),
        },
      ],
      { session },
    );

    // Update totalFollowers for userToFollow
    userToFollow.totalFollowers += 1;
    await userToFollow.save({ session, validateModifiedOnly: true });

    // Update totalFollowing for currentLoggedInUser
    currentLoggedInUser.totalFollowing += 1;
    await currentLoggedInUser.save({ session, validateModifiedOnly: true });

    // Commit the transaction
    await session.commitTransaction();
  } catch (err) {
    // Rollback transaction if any error occurs
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession(); // Always end the session
  }
};

// Unfollow a user with transaction
const unfollowUser = async (userData: JwtPayload, userIdToUnfollow: string) => {
  const session = await mongoose.startSession(); // Start a session

  try {
    session.startTransaction(); // Start a transaction

    // Find the current logged-in user
    const currentLoggedInUser = await User.findOne({
      email: userData.email,
    }).session(session);

    if (!currentLoggedInUser) {
      throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    // Find the user to unfollow
    const userToUnfollow =
      await User.findById(userIdToUnfollow).session(session);
    if (!userToUnfollow) {
      throw new AppError(httpStatus.NOT_FOUND, "User to unfollow not found");
    }

    // Prevent self-unfollowing
    if (currentLoggedInUser._id.equals(userToUnfollow._id)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "You cannot unfollow yourself",
      );
    }

    // Check if the follow relationship exists
    const existingFollow = await Follower.findOne({
      follower: currentLoggedInUser._id,
      following: userToUnfollow._id,
    }).session(session);

    if (!existingFollow) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "You are not following this user",
      );
    }

    // Remove the follower relationship
    await Follower.deleteOne({
      follower: currentLoggedInUser._id,
      following: userToUnfollow._id,
    }).session(session);

    // Decrement totalFollowers for userToUnfollow
    userToUnfollow.totalFollowers -= 1;
    await userToUnfollow.save({ session, validateModifiedOnly: true });

    // Decrement totalFollowing for currentLoggedInUser
    currentLoggedInUser.totalFollowing -= 1;
    await currentLoggedInUser.save({ session, validateModifiedOnly: true });

    // Commit the transaction
    await session.commitTransaction();
  } catch (err) {
    // Rollback the transaction if any error occurs
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession(); // Always end the session
  }
};

// check follow status
const getFollowStatus = async (
  userData: JwtPayload,
  userIdToFollow: string,
) => {
  // Find current logged-in user
  const currentLoggedInUser = await User.findOne({
    email: userData.email,
  });

  if (!currentLoggedInUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // Find the user to follow
  const userToFollow = await User.findById(userIdToFollow);
  if (!userToFollow) {
    throw new AppError(httpStatus.NOT_FOUND, "User to follow not found");
  }

  // Check if the current logged-in user is following the userToFollow
  const followStatus = await Follower.findOne({
    follower: currentLoggedInUser._id,
    following: userIdToFollow,
  });

  // Return true if the follow relationship exists, otherwise false
  return !!followStatus;
};

// get current logged in user followers
const getLoggedInUserFollowers = async (
  userData: JwtPayload,
  query: Record<string, unknown>,
) => {
  const currentLoggedInUser = await User.findOne({
    email: userData.email,
  });

  if (!currentLoggedInUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }
  const followersQuery = new QueryBuilder(
    Follower.find({ following: currentLoggedInUser._id })
      .populate(
        "follower",
        "fullName username email profilePicture totalFollowers totalFollowing",
      )
      .select("follower"),
    query,
  );

  // Await the filter() method
  await followersQuery.filter();

  // Now you can safely call sort, paginate, and fields
  followersQuery.sort().paginate().fields();

  const result = await followersQuery.modelQuery;
  const meta = await followersQuery.countTotal();

  return { result, meta };
};

// get current logged in user following
const getLoggedInUserFollowing = async (
  userData: JwtPayload,
  query: Record<string, unknown>,
) => {
  // Find the current logged-in user
  const currentLoggedInUser = await User.findOne({
    email: userData.email,
  });

  if (!currentLoggedInUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // Build a query to get all users that the current user is following
  const followingQuery = new QueryBuilder(
    Follower.find({ follower: currentLoggedInUser._id })
      .populate(
        "following",
        "fullName username email profilePicture totalFollowers totalFollowing",
      )
      .select("following"),
    query,
  );

  // Await the filter() method
  await followingQuery.filter();

  // Now you can safely call sort, paginate, and fields
  followingQuery.sort().paginate().fields();

  const result = await followingQuery.modelQuery;
  const meta = await followingQuery.countTotal();

  return { result, meta };
};

// get all followers by user id
const getFollowersByUserId = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  // Find the user by ID
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // Build a query to get all followers of the specified user
  const followersQuery = new QueryBuilder(
    Follower.find({ following: user._id })
      .populate(
        "follower",
        "fullName username email profilePicture totalFollowers totalFollowing",
      )
      .select("follower"),
    query,
  );

  // Await the filter() method
  await followersQuery.filter();

  // Now you can safely call sort, paginate, and fields
  followersQuery.sort().paginate().fields();

  const result = await followersQuery.modelQuery;
  const meta = await followersQuery.countTotal();

  return { result, meta };
};

// get all following by user id
const getFollowingByUserId = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  // Find the user by ID
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // Build a query to get all users followed by the specified user
  const followingQuery = new QueryBuilder(
    Follower.find({ follower: user._id })
      .populate(
        "following",
        "fullName username email profilePicture totalFollowers totalFollowing",
      )
      .select("following"),
    query,
  );

  // Await the filter() method
  await followingQuery.filter();

  // Now you can safely call sort, paginate, and fields
  followingQuery.sort().paginate().fields();

  const result = await followingQuery.modelQuery;
  const meta = await followingQuery.countTotal();

  return { result, meta };
};

export const userService = {
  getAllUsers,
  updateProfile,
  updateSocialLinks,
  blockUser,
  unBlockUser,
  followUser,
  unfollowUser,
  getLoggedInUserFollowers,
  getLoggedInUserFollowing,
  getFollowersByUserId,
  getFollowingByUserId,
  getSingleUserByUsername,
  getFollowStatus,
  makeAdmin,
  deleteUserAccount,
  getDeletedUsers,
  restoreUser,
};
