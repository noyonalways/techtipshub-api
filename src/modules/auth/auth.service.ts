import httpStatus from "http-status";
import { JwtPayload } from "jsonwebtoken";
import config from "../../config";
import { AppError } from "../../errors";
import {
  generateResetPasswordEmail,
  generateVerifyEmail,
  isEmailConfigured,
  sendEmail,
} from "../../utils";
import { IUser } from "../user/user.interface";
import User from "../user/user.model";

// register new user
const register = async (payload: IUser) => {
  const existedEmail = await User.findOne({
    email: payload.email,
  })
    .lean()
    .setOptions({ bypassMiddleware: true });

  if (existedEmail) {
    if (existedEmail.isDeleted) {
      throw new AppError(
        409,
        "Email linked to a deleted account. Recover or try a different email.",
      );
    }
    throw new AppError(409, "User already registered");
  }

  const existedUsername = await User.findOne({ username: payload.username })
    .lean()
    .setOptions({ bypassMiddleware: true });
  if (existedUsername) {
    if (existedUsername.isDeleted) {
      throw new AppError(
        409,
        "Username linked to a deleted account. Recover or try a different username.",
      );
    }
    throw new AppError(409, "Username already exists");
  }

  const newUser = await User.create(payload);

  // generate jwt verify token
  const jwtPayload = {
    email: newUser.email,
    role: newUser.role,
  };

  const verifyToken = User.createToken(
    jwtPayload,
    config.jwt_reset_password_secret as string,
    config.jwt_reset_password_expires_in as string,
  );

  const verifyEmailLink = `${config.api_base_url}/auth/verify-email?email=${newUser?.email}&token=${verifyToken}`;

  // send verify email link
  await sendEmail({
    to: {
      name: newUser.fullName,
      address: newUser.email,
    },
    subject: "Verify your email address with 24 hours",
    text: "Please verify your email address with 24 hours",
    html: generateVerifyEmail({
      verifyEmailLink: verifyEmailLink,
      fullName: newUser.fullName,
    }),
  });

  // eslint-disable-next-line no-console
  console.log(`Verify email link sent to ${newUser.email}`);

  return newUser;
};

// login user
const login = async (payload: IUser) => {
  const user = await User.findOne({ email: payload.email }).select("+password");

  if (!user) {
    throw new AppError(404, "User not found");
  }

  if (!user.password) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Incorrect credentials");
    // throw new AppError(
    //   httpStatus.UNAUTHORIZED,
    //   "User register or logged in by social account",
    // );
  }

  if (!(await User.isPasswordMatch(payload.password, user.password))) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Incorrect credentials");
  }

  if (user.status === "Blocked") {
    throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
  }

  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, "User is deleted");
  }

  const jwtPayload = {
    _id: user._id,
    profilePicture: user.profilePicture,
    username: user.username,
    name: user.fullName,
    email: user.email,
    role: user.role,
  };

  const accessToken = User.createToken(
    jwtPayload,
    config.jwt_access_token_secret as string,
    config.jwt_access_token_expires_in as string,
  );

  const refreshToken = User.createToken(
    jwtPayload,
    config.jwt_refresh_token_secret as string,
    config.jwt_refresh_token_expires_in as string,
  );

  return { accessToken, refreshToken };
};

// social login
const socialLogin = async (payload: IUser) => {
  let user = await User.findOne({ email: payload.email });
  if (!user) {
    // create a new user (if not found the user by email)
    payload.username = payload.fullName.toLowerCase().split(" ").join("");
    user = await register(payload);
  }
  const jwtPayload = {
    _id: user._id,
    profilePicture: user.profilePicture,
    username: user.username,
    name: user.fullName,
    email: user.email,
    role: user.role,
  };

  const accessToken = User.createToken(
    jwtPayload,
    config.jwt_access_token_secret as string,
    config.jwt_access_token_expires_in as string,
  );

  const refreshToken = User.createToken(
    jwtPayload,
    config.jwt_refresh_token_secret as string,
    config.jwt_refresh_token_expires_in as string,
  );

  return { accessToken, refreshToken };
};

// get me (current logged in user)
const getMe = async (payload: JwtPayload) => {
  const user = await User.findOne({ email: payload.email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }
  return user;
};

// change-password
const changePassword = async (
  userData: JwtPayload,
  payload: { oldPassword: string; newPassword: string },
) => {
  const user = await User.findOne({ email: userData.email }).select(
    "+password",
  );

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // check the user is already deleted
  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, "User is already deleted");
  }

  // check the is user status
  if (user.status === "Blocked") {
    throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
  }

  // check the password is correct
  const isPasswordMatch = await User.isPasswordMatch(
    payload.oldPassword,
    user?.password,
  );
  if (!isPasswordMatch) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Password did not match");
  }

  // hash new password
  const newHashedPassword = await User.generateHashPassword(
    payload.newPassword,
  );

  return await User.findOneAndUpdate(
    {
      email: userData.email,
      role: userData.role,
    },
    {
      password: newHashedPassword,
      passwordChangeAt: new Date(),
    },
    { new: true, runValidators: true },
  );
};

// forget password
const forgetPassword = async (email: string) => {
  // check the user is exist
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // check the user is already deleted
  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, "User is already deleted");
  }

  // check the is user status
  if (user.status === "Blocked") {
    throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
  }

  // Refuse up front rather than report a link "sent" that never leaves the
  // server. The UI shows a clear message when mail is not configured.
  if (!isEmailConfigured()) {
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      "Email delivery is not configured on this server yet, so a reset link cannot be sent.",
    );
  }

  // generate jwt token
  const jwtPayload = {
    email: user.email,
    role: user.role,
  };

  const resetToken = User.createToken(
    jwtPayload,
    config.jwt_reset_password_secret as string,
    config.jwt_reset_password_expires_in as string,
  );

  // generate reset link. The UI lives in this same application, so the link
  // points at its /reset-password route; the token travels in the fragment so
  // it is never sent to a server in a Referer header or access log.
  const resetUILink = `${config.reset_password_ui_url}?email=${encodeURIComponent(
    user.email,
  )}#token=${resetToken}`;

  // send reset link to user email
  await sendEmail({
    to: {
      name: user.fullName,
      address: user.email,
    },
    subject: "Reset Your Password within 30 minutes",
    text: "Reset Your Password within 30 minutes",
    html: generateResetPasswordEmail({
      resetPasswordLink: resetUILink,
      fullName: user.fullName,
    }),
    // A reset mail that fails to send must not be reported as sent.
    throwOnError: true,
  });

  // eslint-disable-next-line no-console
  console.log(`Password reset link sent to ${user.email}`);

  // Enough for the UI to confirm where the mail went, and nothing more.
  return { email: user.email };
};

// reset password
const resetPassword = async (
  payload: { newPassword: string },
  token: string,
) => {
  // Verify the link's token first so an expired or tampered link reports that
  // clearly. The account comes from the token itself — never from a field the
  // caller can edit — so a valid link can only ever reset its own account.
  let decoded: JwtPayload;
  try {
    decoded = User.verifyToken(
      token,
      config.jwt_reset_password_secret as string,
    ) as JwtPayload;
  } catch (error: any) {
    const message =
      error?.name === "TokenExpiredError"
        ? "This reset link has expired. Request a new one."
        : "This reset link is not valid. Request a new one.";
    throw new AppError(httpStatus.FORBIDDEN, message);
  }

  // check the use is exist or not
  const user = await User.findOne({ email: decoded.email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // check the user is already deleted
  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, "User is already deleted");
  }

  // check the is user status
  if (user.status === "Blocked") {
    throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
  }

  // generate new password
  const newHashedPassword = await User.generateHashPassword(
    payload.newPassword,
  );

  return await User.findOneAndUpdate(
    {
      email: decoded.email,
      role: decoded.role,
    },
    {
      password: newHashedPassword,
      passwordChangeAt: new Date(),
    },
    {
      new: true,
      runValidators: true,
    },
  );
};

// generate access token using refresh token
const generateNewAccessToken = async (refreshToken: string) => {
  const decoded = User.verifyToken(
    refreshToken,
    config.jwt_refresh_token_secret as string,
  );

  // check the use is exist or not
  const user = await User.findOne({ email: decoded.email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // check the user is already deleted
  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, "User is already deleted");
  }

  // check the is user status
  if (user.status === "Blocked") {
    throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
  }

  if (
    user.passwordChangeAt &&
    User.isJWTIssuedBeforePasswordChanged(
      user.passwordChangeAt,
      decoded.iat as number,
    )
  ) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Unauthorized Access");
  }

  const jwtPayload = {
    _id: user._id,
    profilePicture: user.profilePicture,
    username: user.username,
    name: user.fullName,
    email: user.email,
    role: user.role,
  };

  const accessToken = User.createToken(
    jwtPayload,
    config.jwt_access_token_secret as string,
    config.jwt_access_token_expires_in as string,
  );

  return accessToken;
};

export const authService = {
  register,
  login,
  socialLogin,
  getMe,
  changePassword,
  forgetPassword,
  resetPassword,
  generateNewAccessToken,
};
