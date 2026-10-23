import { FilterQuery, Types } from "mongoose";
import { QueryBuilder } from "../../builder";
import Blog from "../blog/blog.model";
import Category from "../category/category.model";
import Comment from "../comment/comment.model";
import User from "../user/user.model";
import View from "../view/view.model";
import Vote from "../vote/vote.model";
import AdminLog from "./admin-log.model";

const DAY_MS = 24 * 60 * 60 * 1000;
const TZ = "UTC";

type TChangeType = "increase" | "decrease" | "no change";

type TWeekStat = {
  value: number;
  previous: number;
  change: string;
  type: TChangeType;
};

type TLeanAuthor = {
  fullName?: string;
  username?: string;
  profilePicture?: string;
};

// `createdAt`/`updatedAt` come from the schema's timestamps option, which the
// document interfaces do not spell out.
type TStamped = { createdAt: Date; updatedAt: Date };

type TTopArticleRow = TStamped & {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  totalViews?: number;
  totalComments?: number;
  upVotes?: number;
  downVotes?: number;
  author?: TLeanAuthor | null;
};

type TTopContributorRow = {
  _id: Types.ObjectId;
  published: number;
  totalViews: number;
  fullName?: string;
  username?: string;
  profilePicture?: string;
};

type TBlogRecentRow = TStamped & {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  author?: TLeanAuthor | null;
};

type TMemberRecentRow = TStamped & {
  _id: Types.ObjectId;
  fullName: string;
  username: string;
  profilePicture?: string;
};

type TCommentRecentRow = TStamped & {
  _id: Types.ObjectId;
  content: string;
  user?: TLeanAuthor | null;
  post?: { title?: string; slug?: string } | null;
};

type TBlogSearchRow = TStamped & {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  totalViews?: number;
  author?: TLeanAuthor | null;
};

type TMemberSearchRow = TStamped & {
  _id: Types.ObjectId;
  fullName: string;
  username: string;
  email: string;
  profilePicture?: string;
  role: string;
  status: string;
};

type TCategorySearchRow = TStamped & {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  postCount: number;
};

type TActivityRow = {
  _id: string;
  views?: number;
  comments?: number;
  blogs?: number;
  members?: number;
  upvotes?: number;
  downvotes?: number;
};

const startOfDay = (now: Date) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate());

const startOfWeek = (now: Date) => {
  // Weeks start on Monday.
  const day = startOfDay(now);
  const offset = (day.getDay() + 6) % 7;
  return new Date(day.getTime() - offset * DAY_MS);
};

// A zero baseline has no percentage: report 100% when something appeared and
// 0% when nothing did, so the UI never shows Infinity or N/A.
const weekStat = (value: number, previous: number): TWeekStat => {
  const change =
    previous === 0
      ? value === 0
        ? "0.00%"
        : "100.00%"
      : `${(((value - previous) / previous) * 100).toFixed(2)}%`;

  const type: TChangeType =
    value > previous ? "increase" : value < previous ? "decrease" : "no change";

  return { value, previous, change, type };
};

const createdSince = (since: Date): FilterQuery<{ createdAt: Date }> => ({
  createdAt: { $gte: since },
});

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const populatedAuthor = (user: TLeanAuthor | null | undefined) => ({
  fullName: user?.fullName ?? "Unknown member",
  username: user?.username ?? "",
  profilePicture: user?.profilePicture ?? "",
});

const dateGroup = {
  $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TZ },
};

const overview = async () => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const previousWeekStart = new Date(weekStart.getTime() - 7 * DAY_MS);
  const last7Days = new Date(now.getTime() - 7 * DAY_MS);

  const [
    todayViews,
    todayComments,
    todayUpvotes,
    todayMembers,
    weekViews,
    previousWeekViews,
    weekComments,
    previousWeekComments,
    weekMembers,
    previousWeekMembers,
    articlesLast7Days,
    commentsLast7Days,
    membersLast7Days,
    topArticleDocs,
    topContributors,
    recentBlogs,
    recentMembers,
    recentComments,
    emptyCategories,
    zeroViewArticles,
  ] = await Promise.all([
    View.countDocuments(createdSince(todayStart)),
    Comment.countDocuments(createdSince(todayStart)),
    Vote.countDocuments({ ...createdSince(todayStart), type: "upvote" }),
    User.countDocuments(createdSince(todayStart)),
    View.countDocuments(createdSince(weekStart)),
    View.countDocuments({
      createdAt: { $gte: previousWeekStart, $lt: weekStart },
    }),
    Comment.countDocuments(createdSince(weekStart)),
    Comment.countDocuments({
      createdAt: { $gte: previousWeekStart, $lt: weekStart },
    }),
    User.countDocuments(createdSince(weekStart)),
    User.countDocuments({
      createdAt: { $gte: previousWeekStart, $lt: weekStart },
    }),
    Blog.countDocuments({
      isDeleted: { $ne: true },
      createdAt: { $gte: last7Days },
    }),
    Comment.countDocuments({
      isDeleted: { $ne: true },
      createdAt: { $gte: last7Days },
    }),
    User.countDocuments({
      isDeleted: { $ne: true },
      createdAt: { $gte: last7Days },
    }),
    Blog.find({ isDeleted: { $ne: true } })
      .sort({ totalViews: -1, _id: -1 })
      .limit(5)
      .select(
        "title slug totalViews totalComments upVotes downVotes createdAt author",
      )
      .populate({ path: "author", select: "fullName username profilePicture" })
      .lean<TTopArticleRow[]>(),
    Blog.aggregate<TTopContributorRow>([
      {
        $match: {
          isDeleted: { $ne: true },
          createdAt: { $gte: new Date(now.getTime() - 30 * DAY_MS) },
        },
      },
      {
        $group: {
          _id: "$author",
          published: { $sum: 1 },
          totalViews: { $sum: { $ifNull: ["$totalViews", 0] } },
        },
      },
      { $sort: { published: -1, totalViews: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: User.collection.name,
          localField: "_id",
          foreignField: "_id",
          as: "author",
        },
      },
      { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          published: 1,
          totalViews: 1,
          fullName: "$author.fullName",
          username: "$author.username",
          profilePicture: "$author.profilePicture",
        },
      },
    ]),
    Blog.find({ isDeleted: { $ne: true } })
      .sort({ createdAt: -1, _id: -1 })
      .limit(8)
      .select("title slug createdAt author")
      .populate({ path: "author", select: "fullName username profilePicture" })
      .lean<TBlogRecentRow[]>(),
    User.find({ isDeleted: { $ne: true } })
      .sort({ createdAt: -1, _id: -1 })
      .limit(8)
      .select("fullName username profilePicture createdAt")
      .lean<TMemberRecentRow[]>(),
    Comment.find({ isDeleted: { $ne: true } })
      .sort({ createdAt: -1, _id: -1 })
      .limit(8)
      .select("content user post createdAt")
      .populate({ path: "user", select: "fullName username profilePicture" })
      .populate({ path: "post", select: "title slug" })
      .lean<TCommentRecentRow[]>(),
    Category.countDocuments({
      isDeleted: { $ne: true },
      postCount: { $lte: 0 },
    }),
    Blog.countDocuments({ isDeleted: { $ne: true }, totalViews: { $lte: 0 } }),
  ]);

  const topArticles = topArticleDocs.map((blog) => ({
    _id: String(blog._id),
    title: blog.title,
    slug: blog.slug,
    totalViews: blog.totalViews ?? 0,
    totalComments: blog.totalComments ?? 0,
    upVotes: blog.upVotes ?? 0,
    downVotes: blog.downVotes ?? 0,
    createdAt: blog.createdAt,
    author: populatedAuthor(blog.author),
  }));

  const recent = [
    ...recentBlogs.map((blog) => ({
      type: "blog" as const,
      id: String(blog._id),
      title: blog.title,
      href: `/blogs/${blog.slug}`,
      actor: populatedAuthor(blog.author),
      createdAt: blog.createdAt,
    })),
    ...recentMembers.map((member) => ({
      type: "member" as const,
      id: String(member._id),
      title: member.fullName,
      href: `/users/@${member.username}`,
      actor: populatedAuthor(member),
      createdAt: member.createdAt,
    })),
    ...recentComments.map((comment) => {
      const content = String(comment.content ?? "");
      const excerpt =
        content.length > 140 ? `${content.slice(0, 140)}...` : content;

      return {
        type: "comment" as const,
        id: String(comment._id),
        title: comment.post?.title ?? "Deleted article",
        href: `/blogs/${comment.post?.slug ?? ""}#comments`,
        excerpt,
        actor: populatedAuthor(comment.user),
        createdAt: comment.createdAt,
      };
    }),
  ]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 8);

  return {
    today: {
      views: todayViews,
      comments: todayComments,
      upvotes: todayUpvotes,
      newMembers: todayMembers,
    },
    week: {
      views: weekStat(weekViews, previousWeekViews),
      comments: weekStat(weekComments, previousWeekComments),
      newMembers: weekStat(weekMembers, previousWeekMembers),
    },
    pending: {
      articlesLast7Days,
      commentsLast7Days,
      newMembersLast7Days: membersLast7Days,
    },
    topArticles,
    topContributors: topContributors.map((author) => ({
      _id: String(author._id),
      fullName: author.fullName ?? "Unknown member",
      username: author.username ?? "",
      profilePicture: author.profilePicture ?? "",
      published: author.published,
      totalViews: author.totalViews,
    })),
    recent,
    health: {
      emptyCategories,
      zeroViewArticles,
    },
  };
};

const MAX_SEARCH_LENGTH = 80;

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const search = async (rawTerm: unknown) => {
  const term =
    typeof rawTerm === "string"
      ? rawTerm.trim().slice(0, MAX_SEARCH_LENGTH)
      : "";

  if (!term) {
    return { blogs: [], members: [], categories: [] };
  }

  const pattern = { $regex: escapeRegex(term), $options: "i" };

  const [blogs, members, categories] = await Promise.all([
    Blog.find({
      isDeleted: { $ne: true },
      $or: [{ title: pattern }, { slug: pattern }],
    })
      .sort({ totalViews: -1 })
      .limit(5)
      .select("title slug totalViews createdAt author")
      .populate({ path: "author", select: "fullName username profilePicture" })
      .lean<TBlogSearchRow[]>(),
    User.find({
      isDeleted: { $ne: true },
      $or: [{ fullName: pattern }, { username: pattern }, { email: pattern }],
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("fullName username email profilePicture role status createdAt")
      .lean<TMemberSearchRow[]>(),
    Category.find({ isDeleted: { $ne: true }, name: pattern })
      .sort({ postCount: -1 })
      .limit(5)
      .select("name description postCount createdAt")
      .lean<TCategorySearchRow[]>(),
  ]);

  return {
    blogs: blogs.map((blog) => ({
      _id: String(blog._id),
      title: blog.title,
      slug: blog.slug,
      totalViews: blog.totalViews ?? 0,
      createdAt: blog.createdAt,
      author: populatedAuthor(blog.author),
    })),
    members: members.map((member) => ({
      _id: String(member._id),
      fullName: member.fullName,
      username: member.username,
      email: member.email,
      profilePicture: member.profilePicture ?? "",
      role: member.role,
      status: member.status,
      createdAt: member.createdAt,
    })),
    categories: categories.map((category) => ({
      _id: String(category._id),
      name: category.name,
      description: category.description ?? "",
      postCount: category.postCount,
      createdAt: category.createdAt,
    })),
  };
};

const activity = async (rawDays: unknown) => {
  const parsed = Number(rawDays);
  const days =
    Number.isFinite(parsed) && parsed > 0
      ? Math.min(90, Math.max(7, Math.trunc(parsed)))
      : 30;

  const firstDay = startOfDay(new Date(Date.now() - (days - 1) * DAY_MS));

  // One grouped pass per collection, not one query per day.
  const [views, comments, blogs, members, upvoteRows, downvoteRows] =
    await Promise.all([
      View.aggregate<TActivityRow>([
        { $match: { createdAt: { $gte: firstDay } } },
        { $group: { _id: dateGroup, views: { $sum: 1 } } },
      ]),
      Comment.aggregate<TActivityRow>([
        { $match: { createdAt: { $gte: firstDay } } },
        { $group: { _id: dateGroup, comments: { $sum: 1 } } },
      ]),
      Blog.aggregate<TActivityRow>([
        { $match: { createdAt: { $gte: firstDay }, isDeleted: { $ne: true } } },
        { $group: { _id: dateGroup, blogs: { $sum: 1 } } },
      ]),
      User.aggregate<TActivityRow>([
        { $match: { createdAt: { $gte: firstDay }, isDeleted: { $ne: true } } },
        { $group: { _id: dateGroup, members: { $sum: 1 } } },
      ]),
      Vote.aggregate<TActivityRow>([
        { $match: { createdAt: { $gte: firstDay }, type: "upvote" } },
        { $group: { _id: dateGroup, upvotes: { $sum: 1 } } },
      ]),
      Vote.aggregate<TActivityRow>([
        { $match: { createdAt: { $gte: firstDay }, type: "downvote" } },
        { $group: { _id: dateGroup, downvotes: { $sum: 1 } } },
      ]),
    ]);

  const byDate = new Map<string, TActivityRow>();
  for (const rows of [
    views,
    comments,
    blogs,
    members,
    upvoteRows,
    downvoteRows,
  ]) {
    for (const row of rows) {
      byDate.set(row._id, { ...byDate.get(row._id), ...row });
    }
  }

  return Array.from({ length: days }, (_, index) => {
    const date = formatDate(new Date(firstDay.getTime() + index * DAY_MS));
    const row = byDate.get(date);

    return {
      date,
      views: row?.views ?? 0,
      comments: row?.comments ?? 0,
      blogs: row?.blogs ?? 0,
      members: row?.members ?? 0,
      upvotes: row?.upvotes ?? 0,
      downvotes: row?.downvotes ?? 0,
    };
  });
};

const getLogs = async (query: Record<string, unknown>) => {
  const requested = Number(query.limit);
  const limit =
    Number.isFinite(requested) && requested > 0
      ? Math.min(200, Math.trunc(requested))
      : 50;

  // Whitelisted keys only: QueryBuilder.filter() would otherwise splice the
  // raw query string into the Mongo filter.
  const logQuery = new QueryBuilder(
    AdminLog.find({}).populate({
      path: "admin",
      select: "fullName username profilePicture",
    }),
    { limit, sort: "-createdAt,-_id" },
  );

  logQuery.sort().paginate().fields();

  const result = await logQuery.modelQuery;
  const meta = await logQuery.countTotal();

  return { result, meta };
};

export const adminService = {
  overview,
  search,
  activity,
  getLogs,
};
