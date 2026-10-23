[![Youtube][youtube-shield]][youtube-url]
[![Facebook][facebook-shield]][facebook-url]
[![Facebook Page][facebook-shield]][facebook-group-url]
[![Instagram][instagram-shield]][instagram-url]
[![LinkedIn][linkedin-shield]][linkedin-url]
[![VS Code Theme][vscode-shield]][vscode-theme-url]

<!-- PROJECT LOGO -->
<br />
<p align="center">
    <img src="https://i.ibb.co.com/8dwgWQk/tech-tips-hub-logo.png" alt="Logo" width="80" height="80" />
    <h3 align="center">
        <a href="https://techtipshub-api.noyonrahman.xyz" target="_blank" >
            TechTipsHub API
        </a>
    </h3>
</p>

## Description:

**TechTipsHub** is an advanced blogging platform tailored for tech enthusiasts to read and write blogs. Users can access both free and premium blogs, with a monthly subscription offering exclusive content. The platform supports features like user registration, email verification, JWT-based authentication, upvoting/downvoting blogs, commenting with replies, and following/unfollowing users. It tracks important user interactions such as views, followers, and following, enhancing the social experience.

---

### **User Features:**

- **User Registration & Login:** Secure registration and login using JWT-based authentication.
- **Email Verification:** Users must verify their email after registration to access full platform features.
- **Read & Write Blogs:** Users can publish their own blogs or read both free and premium content.
- **Upvote/Downvote Blogs:** Users can upvote or downvote blogs to show their preference.
- **Commenting & Replies:** Users can comment on blogs and reply to comments, fostering engagement.
- **Follow/Unfollow Users:** Users can follow or unfollow others, with tracking of followers and following counts.
- **Premium Content Subscription:** Access premium blogs with a monthly subscription.
- **View Tracking:** Track unique blog views while excluding the author’s views.

---

### **Admin Features:**

- **User Management:** Admins can manage user accounts, including viewing, editing, or suspending users.
- **Content Moderation:** Admins can monitor, approve, or delete blogs and comments to ensure community guidelines are followed.
- **Subscription Management:** Admins can manage user subscriptions, view active and expired subscriptions, and handle billing issues.
- **Analytics & Reporting:** Track platform engagement metrics like total views, user growth, upvotes/downvotes, and content performance.

---

### Authentication Routes:

- `/api/v1/auth/register` - **POST** - Register a new user
- `/api/v1/auth/login` - **POST** - Login and receive access/refresh tokens
- `/api/v1/auth/refresh-token` - **POST** - Generate new access token using refresh token
- `/api/v1/auth/forget-password` - **POST** - Send password reset link to email
- `/api/v1/auth/reset-password` - **POST** - Reset password using the reset token
- `/api/v1/auth/me` - **GET** - Get the current logged-in user's details (Requires Auth)
- `/api/v1/auth/change-password` - **PUT** - Change the user's password (Requires Auth)

### User Routes:

- `/api/v1/users` - (moved to `/api/v1/admin/users`)
- `/api/v1/users/:username` - **GET** - Get a single user by username
- `/api/v1/users/update-profile` - **PATCH** - Update logged-in user profile
- `/api/v1/users/profile/update-social-links` - **PUT** - Update user profile social links
- `/api/v1/users/:id/block` - (moved to `PATCH /api/v1/admin/users/:id/block`)
- `/api/v1/users/:id/unblock` - (moved to `PATCH /api/v1/admin/users/:id/unblock`)
- `/api/v1/users/:id/follow` - **PUT** - Follow a user (Requires Auth)
- `/api/v1/users/:id/unfollow` - **DELETE** - Unfollow a user (Requires Auth)
- `/api/v1/users/my-followers` - **GET** - Get current logged-in user's followers
- `/api/v1/users/my-following` - **GET** - Get current logged-in user's following
- `/api/v1/users/:id/followers` - **GET** - Get all followers by user ID
- `/api/v1/users/:id/following` - **GET** - Get all following by user ID

### Category Routes:

- `/api/v1/categories` - **GET** - Get all categories
- `/api/v1/categories` - **POST** - (moved to `POST /api/v1/admin/categories`)
- `/api/v1/categories/:id` - **GET** - Get a single category by ID
- `/api/v1/categories/:id` - **DELETE** - (moved to `DELETE /api/v1/admin/categories/:id`)
- `/api/v1/categories/:id` - **PATCH** - (moved to `PATCH /api/v1/admin/categories/:id`)

## Blog Routes

- `/api/v1/blogs` - **POST** - Create a new blog (requires user authentication)
- `/api/v1/blogs` - **GET** - Get all blogs (public access)
- `/api/v1/blogs/my-blogs` - **GET** - Get all blogs by the current logged-in user (requires user authentication)
- `/api/v1/blogs/:slug` - **GET** - Get a single blog by slug (access depends on the blog type)
- `/api/v1/blogs/:id/vote` - **PUT** - Vote on a blog (requires user authentication)
- `/api/v1/blogs/:id/comments` - **POST** - Comment on a blog (requires user authentication)
- `/api/v1/blogs/:id/comments` - **GET** - Get all comments by blog ID (requires user authentication)
- `/api/v1/blogs/users/:userId` - **GET** - Get all blogs by user ID (public access)

### Admin Routes:

Every admin endpoint lives under `/api/v1/admin` and requires the Admin role. See the
header of `src/modules/admin/admin.routes.ts` for the full list.

### Subscriptions Routes:


- `/api/v1/subscriptions/subscribe` - **POST** - Subscribe to a premium plan (requires user authentication)

### Payments Routes:

- `/api/v1/payments/confirmation` - **POST** - Check payment confirmation
- `/api/v1/payments/failed` - **POST** - Handle payment failure
- `/api/v1/payments/canceled` - **GET** - Handle payment cancellation

### Tech Stack

| Icon                                                                                                                   | Technology Name |
| ---------------------------------------------------------------------------------------------------------------------- | --------------- |
| ![Node.js](https://img.shields.io/static/v1?label=&message=Node.js&color=339933&logo=nodedotjs&logoColor=white)        | Node.js         |
| ![Express](https://img.shields.io/static/v1?label=&message=Express&color=404D59)                                       | Express         |
| ![TypeScript](https://img.shields.io/static/v1?label=&message=TypeScript&color=007ACC&logo=typescript&logoColor=white) | TypeScript      |
| ![MongoDB](https://img.shields.io/static/v1?label=&message=MongoDB&color=47A248&logo=mongodb&logoColor=white)          | MongoDB         |
| ![Bcrypt](https://img.shields.io/static/v1?label=&message=Bcrypt&color=EFCA00)                                         | Bcrypt          |
| ![Zod](https://img.shields.io/static/v1?label=&message=Zod&color=3068b7&logo=zod&logoColor=white)                      | Zod             |
| ![Nodemailer](https://img.shields.io/static/v1?label=&message=Nodemailer&color=005571&logo=npm&logoColor=white)        | Nodemailer      |
| ![Multer](https://img.shields.io/static/v1?label=&message=Multer&color=34B7F1)                                         | Multer          |
| ![Cloudinary](https://img.shields.io/static/v1?label=&message=Cloudinary&color=3A8E4D)                                 | Cloudinary      |
| ![Axios](https://img.shields.io/static/v1?label=&message=Axios&color=5A29E3&logo=axios&logoColor=white)                | Axios           |
| ![JWT](https://img.shields.io/static/v1?label=&message=JWT&color=000000&logo=json-web-tokens&logoColor=white)          | JWT             |

## 💻 Running locally:

To run the this project locally, follow these steps:

### 1. Clone the repository from GitHub:

```sh
git clone https://github.com/noyonalways/tech-tips-hub-api.git
```

### 2. Navigate into the project directory:

```sh
cd tech-tips-hub-api
```

### 3. Install Dependencies (npm or yarn):

```sh
npm install
```

or

```sh
yarn
```

### 4. Set up environment variables:

- Create a `.env` file in the root directory.
- Define necessary environment variables such as database connection URL, PORT, etc. Refer to any provided `.env.example` file or documentation for required variables.

```sh
# app configuration
PORT="your_applications_port"
DATABASE_URL="your_database_connection_url"
NODE_ENV=development
JWT_ACCESS_TOKEN_SECRET="your_jwt_access_token_secret"
JWT_REFRESH_TOKEN_SECRET="your_jwt_refresh_token_secret"
JWT_ACCESS_TOKEN_EXPIRES_IN="your_jwt_access_token_expiration_duration"
JWT_REFRESH_TOKEN_EXPIRES_IN="your_jwt_refresh_token_expiration_duration"

# reset password configuration
JWT_RESET_PASSWORD_SECRET="your_jwt_reset_password_secret"
JWT_RESET_PASSWORD_EXPIRES_IN="your_jwt_reset_password_expiration_duration"
RESET_PASSWORD_UI_URL="your_reset_password_ui_url"

# SMTP authentication
SMTP_AUTH_USER="your_smtp_auth_user_email"
SMTP_AUTH_PASSWORD="your_smtp_auth_password"

# nodemailer
NODEMAILER_EMAIL_FROM="your_nodemailer_email"

# hash password
BCRYPT_SALT_ROUND="bcrypt_salt_round"

# cloudinary configuration
CLOUD_NAME="your_cloudinary_cloud_name"
CLOUDINARY_API_KEY="your_cloudinary_api_key"
CLOUDINARY_API_SECRET="your_cloudinary_api_secret"

# other configuration
API_BASE_URL="your_applications_api_base_url"
CLIENT_BASE_URL="your_applications_client_base_url"

AAMARPAY_GATEWAY_BASE_URL="aamarpay_gateway_base_url"
AAMARPAY_STORE_ID="aamarpay_store_id"
AAMARPAY_SIGNATURE_KEY="aamarpay_signature_key"
```

### 4. Run the Application:

```sh
npm run dev
```

or

```sh
yarn dev
```

## Contact

- Email: [contact.techtipshub@noyonrahman.com](mailto:contact.techtipshub@noyonrahman.com)
- LinkedIn: [Noyon Rahman](https://linkedin.com/in/noyonalways)

<!-- MARKDOWN LINKS & IMAGES -->

[youtube-shield]: https://img.shields.io/badge/-Youtube-black.svg?style=round-square&logo=youtube&color=555&logoColor=white
[youtube-url]: https://youtube.com/@deskofnoyon
[facebook-shield]: https://img.shields.io/badge/-Facebook-black.svg?style=round-square&logo=facebook&color=555&logoColor=white
[facebook-url]: https://facebook.com/noyonalways
[facebook-group-url]: https://facebook.com/webbronoyon
[instagram-shield]: https://img.shields.io/badge/-Instagram-black.svg?style=round-square&logo=instagram&color=555&logoColor=white
[instagram-url]: https://instagram.com/noyonalways
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=round-square&logo=linkedin&colorB=555
[linkedin-url]: https://linkedin.com/in/noyonalways
[vscode-shield]: https://img.shields.io/badge/-VS%20Code%20Theme-black.svg?style=round-square&logo=visualstudiocode&colorB=555
[vscode-theme-url]: https://marketplace.visualstudio.com/items?itemName=noyonalways.codevibe-themes
