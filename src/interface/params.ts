/**
 * Route params used across the API.
 *
 * Express 5 types `req.params` values as `string | string[]`. All routes here
 * use single-segment params (`/:id`, `/:slug`, `/:username`, ...), so the value
 * is always a string at runtime. Controllers pass this to `catchAsync<T>` to
 * narrow the param type instead of casting at each call site.
 */
export type TRouteParams = {
  id: string;
  username: string;
  slug: string;
  userId: string;
  transactionId: string;
};
