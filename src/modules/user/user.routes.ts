import { NextFunction, Request, Response, Router } from "express";
import { multerUpload } from "../../config/multer.config";
import { USER_ROLE } from "../../constant";
import { auth, validateRequest } from "../../middlewares";
import { catchAsync } from "../../utils";
import { userController } from "./user.controller";
import { userValidationSchema } from "./user.validation";

const userRouter: Router = Router();

// Literal paths must stay above "/:username", or they are read as a username.
userRouter.patch(
  "/update-profile",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  multerUpload.single("image"),
  catchAsync((req: Request, _res: Response, next: NextFunction) => {
    if (req.file?.path) {
      req.body.data = JSON.stringify({
        ...JSON.parse(req.body.data || "{}"),
        profilePicture: req.file.path,
      });
    }

    if (typeof req.body.data === "string" && req.body.data.trim()) {
      req.body = { ...JSON.parse(req.body.data) };
    } else {
      req.body = {};
    }

    next();
  }),
  validateRequest(userValidationSchema.updateProfile),
  userController.updateProfile,
);

// update user profile social links
userRouter.put(
  "/profile/update-social-links",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  validateRequest(userValidationSchema.updateSocialLinks),
  userController.updateSocialLinks,
);

// follow a user (id: indicates that the user wanted to follow)
userRouter.put("/:id/follow", auth(USER_ROLE.USER), userController.followUser);

// unfollow a user (id: indicates that the user wanted to unfollow)
userRouter.delete(
  "/:id/unfollow",
  auth(USER_ROLE.USER),
  userController.unfollowUser,
);

// check the follow status
userRouter.get(
  "/:id/follow-status",
  auth(USER_ROLE.USER),
  userController.getFollowStatus,
);

// get current logged is user followers
userRouter.get(
  "/my-followers",
  auth(USER_ROLE.USER),
  userController.getLoggedInUserFollowers,
);

// get current logged is user following
userRouter.get(
  "/my-following",
  auth(USER_ROLE.USER),
  userController.getLoggedInUserFollowing,
);

// get all followers by user id
userRouter.get("/:id/followers", userController.getFollowersByUserId);

// get all following by user id
userRouter.get("/:id/following", userController.getFollowingByUserId);

// get user details by username. Kept last so it cannot swallow the paths above.
userRouter.get("/:username", userController.getSingleUserByUsername);

export default userRouter;
