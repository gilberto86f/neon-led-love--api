export type ApiNeonResponse<R = unknown> = {
  success?: number;
  status?: number;
  error?: any;
  results?: R[];
  data?: R;
  total?: number;
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
  total?: number,
  status = 200,
): ApiNeonResponse<R> => ({
  success: 1,
  status,
  results,
  total: total ?? results.length,
});

export const fail = (error: any, status = 400): ApiNeonResponse => ({
  success: 0,
  status,
  error,
});
