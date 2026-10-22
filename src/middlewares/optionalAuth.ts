import jwt, { JwtPayload } from "jsonwebtoken";
import config from "../config";
import User from "../modules/user/user.model";
import { catchAsync } from "../utils";

/**
 * Attaches the decoded user to `req.user` when a valid access token is sent,
 * and simply continues when it is missing or invalid.
 *
 * Use this on routes that must stay open to guests but behave differently for
 * signed-in users (e.g. a single post shows a preview to guests and the full
 * article to logged-in users). Never use it where a user is required — use the
 * `auth()` middleware for that.
 */
const optionalAuth = catchAsync(async (req, _res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(
      token,
      config.jwt_access_token_secret as string,
    ) as JwtPayload;

    const user = await User.findOne({ email: decoded.email });
    if (!user || user.isDeleted || user.status === "Blocked") {
      return next();
    }

    req.user = decoded;
  } catch {
    // An expired or malformed token just means "guest" on this route.
  }

  next();
});

export default optionalAuth;
