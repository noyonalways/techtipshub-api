import httpStatus from "http-status";
import { JwtPayload } from "jsonwebtoken";
import mongoose from "mongoose";
import { QueryBuilder } from "../../builder";
import { USER_ROLE, USER_STATUS } from "../../constant";
import { AppError } from "../../errors";
import Comment from "../comment/comment.model";
import Follower from "../follower/follower.model";
import Post from "../post/post.model";
import View from "../view/view.model";
import Vote from "../vote/vote.model";
import { IUser, TSocialLink } from "./user.interface";
import User from "./user.model";

// get all users
const getAllUsers = async (query: Record<string, unknown>) => {
  const userQuery = new QueryBuilder(User.find({}), query).search([
    "fullName",
    "email",
    "username",
  ]);

  // Await the filter() method
  await userQuery.filter();

  // Now you can safely call sort, paginate, and fields
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
const blockUser = async (id: string) => {
  const user = await User.findById(id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.status === USER_STATUS.BLOCKED) {
    throw new AppError(httpStatus.BAD_REQUEST, "User is already Blocked");
  }

  return await User.findByIdAndUpdate(
    id,
    { status: USER_STATUS.BLOCKED },
    { new: true, runValidators: true },
  );
};

// unblock a user (admin only)
const unBlockUser = async (id: string) => {
  const user = await User.findById(id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.status === USER_STATUS.ACTIVE) {
    throw new AppError(httpStatus.BAD_REQUEST, "User is already Active");
  }

  return await User.findByIdAndUpdate(
    id,
    { status: USER_STATUS.ACTIVE },
    { new: true, runValidators: true },
  );
};

// make a user to admin (admin only)
const makeAdmin = async (id: string) => {
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

  return await User.findByIdAndUpdate(
    id,
    { role: USER_ROLE.ADMIN },
    { new: true, runValidators: true },
  );
};

// delete user account (admin only)
const deleteUserAccount = async (id: string) => {
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
    // 1. Delete user's posts
    await Post.deleteMany({ author: user._id }, { session });

    // 2. Delete user's comments and decrement totalComments for each post
    const userComments = await Comment.find({ user: user._id });
    for (const comment of userComments) {
      await Post.findByIdAndUpdate(
        comment.post,
        { $inc: { totalComments: -1 } },
        { session },
      );
    }
    await Comment.deleteMany({ user: user._id }, { session });

    // 3. Delete user's views and decrement totalViews for each post
    const userViews = await View.find({ user: user._id });
    for (const view of userViews) {
      await Post.findByIdAndUpdate(
        view.post,
        { $inc: { totalViews: -1 } },
        { session },
      );
    }
    await View.deleteMany({ user: user._id }, { session });

    // 4. Delete user's votes and decrement upVotes or downVotes for each post
    const userVotes = await Vote.find({ user: user._id });
    for (const vote of userVotes) {
      if (vote.type === "upvote") {
        await Post.findByIdAndUpdate(
          vote.post,
          { $inc: { upVotes: -1 } },
          { session },
        );
      } else if (vote.type === "downvote") {
        await Post.findByIdAndUpdate(
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
};
