export function getParamId(param: string | string[] | undefined): string {
  if (typeof param === 'string') return param;
  if (Array.isArray(param) && param.length > 0) return param[0];
  return '';
}
