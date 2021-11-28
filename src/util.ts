export function concatArray(array0: Float32Array, array1: Float32Array) {
  const concat = new Float32Array(array0.length + array1.length);
  concat.set(array0);
  concat.set(array1, array0.length);
  return concat;
}

export function toFloat(num: number | undefined, defaultValue = 1) {
  const n = num !== undefined ? num : defaultValue;
  if (Number.isInteger(n)) {
    return `${n}.0`;
  }
  return n;
}
