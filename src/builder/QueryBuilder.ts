import { FilterQuery, Query } from "mongoose";
import Category from "../modules/category/category.model";

class QueryBuilder<T> {
  public modelQuery: Query<T[], T>;
  public query: Record<string, unknown>;

  constructor(modelQuery: Query<T[], T>, query: Record<string, unknown>) {
    this.modelQuery = modelQuery;
    this.query = query;
  }

  // all methods
  search(searchableFields: string[]) {
    const searchTerm = this?.query?.searchTerm;
    if (searchTerm) {
      this.modelQuery = this.modelQuery.find({
        $or: searchableFields.map(
          (field) =>
            ({
              [field]: { $regex: searchTerm, $options: "i" },
            }) as FilterQuery<T>,
        ),
      });
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
