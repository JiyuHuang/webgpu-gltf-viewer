export type TypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Uint32Array
  | Float32Array;

export function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max);
}

export function joinArray(arrays: Array<Float32Array>) {
  let length = 0;
  arrays.forEach((array) => {
    length += array.length;
  });
  const joined = new Float32Array(length);
  length = 0;
  arrays.forEach((array) => {
    joined.set(array, length);
    length += array.length;
  });
  return joined;
}

export function toFloat(num: number | undefined, defaultValue = 1) {
  const n = num !== undefined ? num : defaultValue;
  if (Number.isInteger(n)) {
    return `${n}.0`;
  }
  return n;
}
