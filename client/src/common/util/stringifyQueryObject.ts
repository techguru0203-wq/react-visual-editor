export default function stringifyQueryObject(queryObject: Record<string, any>) {
  const queryParams = Object.keys(queryObject).map(key => {
    const value = queryObject[key];
    if (Array.isArray(value)) {
      return value.map(v => `${encodeURIComponent(key)}=${encodeURIComponent(v)}`).join('&');
    } else {
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    }
  });

  return queryParams.length ? queryParams.join("&") : "";
}