export type ApiNeonResponse<R = unknown> = {
  success?: number;
  status?: number;
  error?: any;
  /**
   * Machine-readable extra context for an error (only ever set when
   * `success: 0`). Optional and additive — responses that don't need it omit
   * the key entirely, so the envelope shape is unchanged for every existing
   * endpoint. See `HttpError.details`.
   */
  details?: any;
  results?: R[];
  data?: R;
  total?: number;
  page?: number;
  perPage?: number;
  previous?: string;
  next?: string;
};

export const ok = <R>(data: R, status = 200): ApiNeonResponse<R> => ({
  success: 1,
  status,
  data,
});

export const okList = <R>(
  results: R[],
  opts: { total?: number; page?: number; perPage?: number; status?: number } = {},
): ApiNeonResponse<R> => ({
  success: 1,
  status: opts.status ?? 200,
  results,
  total: opts.total ?? results.length,
  page: opts.page,
  perPage: opts.perPage,
});

export const fail = (error: any, status = 400, details?: any): ApiNeonResponse => ({
  success: 0,
  status,
  error,
  ...(details === undefined ? {} : { details }),
});
