export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function parsePagination(query: PaginationParams, maxLimit = 100): { skip: number; limit: number; page: number } {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;
  return { skip, limit, page };
}

export function paginationMeta(page: number, limit: number, total: number): PaginationMeta {
  const pages = Math.ceil(total / limit) || 1;
  return {
    page,
    limit,
    total,
    pages,
    hasNext: page < pages,
    hasPrev: page > 1,
  };
}
