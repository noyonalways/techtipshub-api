import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { model, Schema } from "mongoose";
import config from "../../config";
import {
  SocialPlatform,
  UserGender,
  UserRoles,
  UserStatus,
} from "./user.constant";
import { IUser, IUserModel, TSocialLink } from "./user.interface";

const socialLinksSchema = new Schema<TSocialLink>(
  {
    platform: {
      type: String,
      enum: {
        values: SocialPlatform,
        message: "{VALUE} is not a valid social platform",
      },
    },
    url: {
      type: String,
      required: [true, "Url is required"],
    },
  },
  { _id: false },
);

const userSchema = new Schema<IUser, IUserModel>(
  {
    fullName: {
      type: String,
      trim: true,
      required: [true, "Full Name is required"],
    },
    username: {
      type: String,
      trim: true,
      required: [true, "Username is required"],
      unique: true,
    },
    bio: {
      type: String,
      default: "",
    },
    designation: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      required: [true, "Email is required"],
      unique: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    location: {
      type: String,
      default: "",
    },
    password: {
      type: String,
      minlength: [6, "Password must be at least 6 characters"],
      select: 0,
    },
    passwordChangeAt: {
      type: Date,
    },
    profilePicture: {
      type: String,
      default: "",
    },
    gender: {
      type: String,
      enum: {
        values: UserGender,
        message: "{VALUE} is not a valid gender",
      },
    },
    role: {
      type: String,
      enum: {
        values: UserRoles,
        message: "{VALUE} is not a valid role",
      },
      default: "User",
    },
    status: {
      type: String,
      enum: {
        values: UserStatus,
        message: "{VALUE} is not a valid status",
      },
      default: "Active",
    },
    totalFollowers: {
      type: Number,
      default: 0,
    },
    totalFollowing: {
      type: Number,
      default: 0,
    },
    // Stored as `totalPosts` for database compatibility; exposed as `totalBlogs`.
    totalPosts: {
      type: Number,
      default: 0,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    socialLinks: {
      type: [socialLinksSchema],
      default: [],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// The field is stored as `totalPosts` so existing documents keep working, but
// the API speaks `totalBlogs` and the client reads that name.
userSchema.virtual("totalBlogs").get(function () {
  return this.totalPosts;
});

userSchema.pre("find", function (next) {
  if (!this.getOptions()?.bypassMiddleware) {
    this.find({ isDeleted: { $ne: true } });
  }
  next();
});

userSchema.pre("findOne", function (next) {
  if (!this.getOptions()?.bypassMiddleware) {
    this.find({ isDeleted: { $ne: true } });
  }
  next();
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next(); // Skip hashing if the password hasn't been modified
  }

  this.password = await bcrypt.hash(
    this.password,
    Number(config.bcrypt_salt_round),
  );
  next();
});

userSchema.post("save", function (doc, next) {
  doc.password = "";
  next();
});

// user static methods
userSchema.statics.isPasswordMatch = function (
  plainTextPassword: string,
  hashedPassword,
) {
  return bcrypt.compare(plainTextPassword, hashedPassword);
};

userSchema.statics.generateHashPassword = async function (
  plainTextPassword: string,
) {
  return await bcrypt.hash(plainTextPassword, Number(config.bcrypt_salt_round));
};

userSchema.statics.createToken = function (
  jwtPayload: { email: string; role: string },
  secret: string,
  expiresIn: string,
) {
  return jwt.sign(jwtPayload, secret, {
    // expiresIn comes from env vars, which are typed as plain `string`;
    // jsonwebtoken's SignOptions wants the `ms` StringValue union ("15m", "7d").
    expiresIn: expiresIn as SignOptions["expiresIn"],
  });
};

userSchema.statics.verifyToken = function (token: string, secret: string) {
  return jwt.verify(token, secret);
};

userSchema.statics.isJWTIssuedBeforePasswordChanged = function (
  passwordChangedTimestamp: Date,
  jwtIssuedTimestamp: number,
) {
  const passwordChangedTime =
    new Date(passwordChangedTimestamp).getTime() / 1000;
  return passwordChangedTime > jwtIssuedTimestamp;
};

const User = model<IUser, IUserModel>("User", userSchema);
export default User;
