import { PaginatedResult } from '../interfaces/paginated-result.interface';

export function paginate<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return { items, total, page, limit };
}

export function paginationSkip(page: number, limit: number): number {
  return (page - 1) * limit;
}
