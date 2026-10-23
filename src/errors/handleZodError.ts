import { ZodError } from "zod";
import { TErrorSources, TGenericErrorResponse } from "../interface/error";

const handleZodError = (error: ZodError): TGenericErrorResponse => {
  const errorSources: TErrorSources = error.issues.map((issue) => {
    // Zod 4 types issue.path as PropertyKey[] (may include symbol), while
    // TErrorSources only allows string | number.
    const path = issue.path as (string | number)[];
    return {
      path: path.slice(1).join(".") || path[0],
      message: issue.message,
    };
  });

  const statusCode = 400;
  return {
    statusCode,
    message: "Validation Error",
    errorSources,
  };
};

export default handleZodError;
