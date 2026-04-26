export type ApiNeonResponse<R = unknown> = {
  success?: number;
  status?: number;
  error?: any;
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

export const fail = (error: any, status = 400): ApiNeonResponse => ({
  success: 0,
  status,
  error,
});
