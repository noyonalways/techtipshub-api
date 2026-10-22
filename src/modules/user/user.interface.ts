import { JwtPayload } from "jsonwebtoken";
import { Document, Model } from "mongoose";

export type TUserRole = "User" | "Admin";
export type TUserStatus = "Active" | "Blocked";
export type TUserGender = "Male" | "Female" | "Other";
export type TSocialPlatform =
  | "Facebook"
  | "Instagram"
  | "Linkedin"
  | "Twitter"
  | "Github"
  | "Youtube";

export type TSocialLink = {
  platform: TSocialPlatform;
  url: string;
};

export interface IUser extends Document {
  fullName: string;
  username: string;
  bio: string;
  designation: string;
  email: string;
  phone: string;
  gender: TUserGender;
  password: string;
  passwordChangeAt?: Date;
  profilePicture: string;
  role: TUserRole;
  status: TUserStatus;
  totalFollowers: number;
  totalFollowing: number;
  totalPosts: number;
  socialLinks: TSocialLink[];
  location: string;
  dateOfBirth: Date;
  isVerified: boolean;
  isDeleted: boolean;
}

export interface IUserModel extends Model<IUser> {
  generateHashPassword(
    plainTextPassword: string,
    saltRound?: number,
  ): Promise<string>;

  isPasswordMatch(
    plainTextPassword: string,
    hashedPassword: string,
  ): Promise<boolean>;

  createToken(
    jwtPayload: JwtPayload,
    secret: string,
    expiresIn: string,
  ): string;

  verifyToken(token: string, secret: string): JwtPayload;

  isJWTIssuedBeforePasswordChanged(
    passwordChangedTimestamp: Date,
    jwtIssuedTimestamp: number,
  ): boolean;
}
