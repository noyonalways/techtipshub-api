import { FilterQuery, Query } from "mongoose";
import Category from "../modules/category/category.model";

/** Max characters kept from one search term. */
const MAX_TERM_LENGTH = 200;
/** Max comma-separated terms used from one search string. */
const MAX_TERMS = 5;
/** Terms this short cannot use an index prefix, so they are substring-matched. */
const PREFIX_MIN_LENGTH = 3;

export const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Split a raw `searchTerm` into cleaned terms. Accepts a string (`"a,b"`) or
 * repeated keys (`?searchTerm=a&searchTerm=b`) and ignores anything else, so
 * no request value reaches Mongo as an object.
 */
export const parseSearchTerms = (value: unknown): string[] => {
  const parts: unknown[] = Array.isArray(value) ? value : [value];

  const terms: string[] = [];
  for (const part of parts) {
    if (typeof part !== "string") continue;
    for (const piece of part.split(",")) {
      const term = piece.trim().slice(0, MAX_TERM_LENGTH);
      if (term) terms.push(term);
    }
  }

  return Array.from(new Set(terms)).slice(0, MAX_TERMS);
};

type TSearchSyntax = {
  /**
   * Builds one condition for an escaped term. `indexed` is true for the
   * prefix-only pass on enum-like fields, so those fields can be served by a
   * plain index ({ status: 1, _id: -1 }).
   */
  leaf: (escaped: string, indexed: boolean) => Record<string, unknown>;
  /** Enum-like fields: matched again as a case-insensitive prefix. */
  prefixFields?: string[];
};

/**
 * Build an `$or` of regex conditions, one condition per term and field. Every
 * term is regex-escaped, so a search string can never smuggle in a pattern.
 * Terms of three characters or more match as a prefix (`^term`), which Mongo
 * can answer from a plain index; shorter terms fall back to a substring match.
 */
export const buildSearchFilter = (
  value: unknown,
  { leaf, prefixFields = [] }: TSearchSyntax,
): FilterQuery<unknown> | undefined => {
  const terms = parseSearchTerms(value);
  if (terms.length === 0) return undefined;

  const conditions: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  const push = (condition: Record<string, unknown>) => {
    const key = JSON.stringify(condition);
    if (seen.has(key)) return;
    seen.add(key);
    conditions.push(condition);
  };

  for (const term of terms) {
    const escaped = escapeRegex(term);

    for (const field of prefixFields) {
      push({ [field]: leaf(`^${escaped}`, true) });
    }

    push(leaf(escaped, false));
  }

  return { $or: conditions };
};

class QueryBuilder<T> {
  public modelQuery: Query<T[], T>;
  public query: Record<string, unknown>;

  constructor(modelQuery: Query<T[], T>, query: Record<string, unknown>) {
    this.modelQuery = modelQuery;
    this.query = query;
  }

  // all methods
  search(searchableFields: string[], valueFields: string[] = []) {
    const searchTerm = this?.query?.searchTerm;
    if (searchTerm) {
      // Every term has to match one of the fields (AND over terms, OR over
      // fields), so "react basics" finds titles that contain both words.
      // `valueFields` (status, role) are searched too, so typing "Blocked" in
      // the panel's search box narrows the list like a dedicated filter; they
      // are matched on an index-friendly prefix.
      const filter = buildSearchFilter(searchTerm, {
        leaf: (escaped) => {
          const fields = searchableFields.map((field) => ({
            [field]: {
              $regex:
                escaped.length >= PREFIX_MIN_LENGTH ? `^${escaped}` : escaped,
              $options: "i",
            },
          }));

          for (const field of valueFields) {
            fields.push({
              [field]: { $regex: `^${escaped}`, $options: "i" },
            });
          }

          return fields.length === 1 ? fields[0] : { $or: fields };
        },
        prefixFields: valueFields,
      });

      if (filter) {
        this.modelQuery = this.modelQuery.find({
          $and: [filter],
        } as FilterQuery<T>);
      }
    }
    return this;
  }

  // New method to get the ObjectId for a category name
  private async getCategoryIdByName(category: string) {
    const foundedCategory = await Category.findOne({ name: category });
    return foundedCategory;
  }

  // Make filter async to await category ID resolution
  async filter() {
    const queryObj = { ...this.query }; // copy
    // Filtering
    const excludeFields = ["searchTerm", "sort", "limit", "page", "fields"];

    excludeFields.forEach((el) => delete queryObj[el]);

    if (queryObj.category) {
      const foundCat = await this.getCategoryIdByName(
        queryObj.category as string,
      );
      if (foundCat) {
        queryObj.category = foundCat._id.toString();
      } else {
        delete queryObj.category;
      }
    }
    this.modelQuery = this.modelQuery.find(queryObj as FilterQuery<T>);

    return this;
  }

  sort() {
    const sort =
      (this?.query?.sort as string)?.split(",")?.join(" ") || "-createdAt";
    this.modelQuery = this.modelQuery.sort(sort as string);

    return this;
  }

  /** Set an explicit sort string (comma-separated field list). */
  sortBy(sort: string) {
    this.modelQuery = this.modelQuery.sort(sort.split(",").join(" "));

    return this;
  }

  paginate() {
    const page = Number(this?.query?.page) || 1;
    const limit = Number(this?.query?.limit) || 10;
    const skip = (page - 1) * limit;

    this.modelQuery = this.modelQuery.skip(skip).limit(limit);

    return this;
  }

  fields() {
    const fields =
      (this?.query?.fields as string)?.split(",")?.join(" ") || "-__v";

    this.modelQuery = this.modelQuery.select(fields);
    return this;
  }

  async countTotal() {
    const totalQueries = this.modelQuery.getFilter();
    const total = await this.modelQuery.model.countDocuments(totalQueries);
    const page = Number(this?.query?.page) || 1;
    const limit = Number(this?.query?.limit) || 10;
    const totalPages = Math.ceil(total / limit);

    return {
      limit,
      page,
      total,
      totalPages,
    };
  }
}

export default QueryBuilder;
