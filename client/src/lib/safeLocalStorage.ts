export function getValue(key: string) {
  if (typeof window === 'undefined') {
    return null;
  }
  const value = localStorage.getItem(key);
  try {
    return JSON.parse(value!);
  } catch (e) {
    // not a JSON value
  }
  return value;
}

export function setValue(key: string, value: any) {
  if (typeof window === 'undefined') {
    return;
  }
  const valueToSet = typeof value === 'string' ? value : JSON.stringify(value);
  localStorage.setItem(key, valueToSet);
}
