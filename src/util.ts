export function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max);
}

export function toFloat(num: number | undefined, defaultValue = 1) {
  const n = num !== undefined ? num : defaultValue;
  if (Number.isInteger(n)) {
    return `${n}.0`;
  }
  return n;
}

export type TypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Uint32Array
  | Float32Array;

export function newTypedArray(
  type: string | number,
  buffer: ArrayBuffer,
  byteOffset: number,
  length: number
) {
  switch (type) {
    case 5120:
    case 'BYTE':
      return new Int8Array(buffer, byteOffset, length);
    case 5121:
    case 'UNSIGNED_BYTE':
      return new Uint8Array(buffer, byteOffset, length);
    case 5122:
    case 'SHORT':
      return new Int16Array(buffer, byteOffset, length);
    case 5123:
    case 'UNSIGNED_SHORT':
      return new Uint16Array(buffer, byteOffset, length);
    case 5125:
    case 'UNSIGNED_INT':
      return new Uint32Array(buffer, byteOffset, length);
    case 5126:
    case 'FLOAT':
      return new Float32Array(buffer, byteOffset, length);
    default:
      throw new Error('invalid component type');
  }
}

export function toIndexArray(array: TypedArray): Uint16Array | Uint32Array {
  if (array instanceof Uint16Array || array instanceof Uint32Array) {
    return array;
  }
  let toArray;
  if (array instanceof Float32Array) {
    toArray = new Uint32Array(array.length);
  } else {
    toArray = new Uint16Array(array.length);
  }
  array.forEach((element, index) => {
    toArray[index] = element;
  });
  return toArray;
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

export function createGPUBuffer(
  array: TypedArray,
  usage: number,
  device: GPUDevice
) {
  const buffer = device.createBuffer({
    size: (array.byteLength + 3) & ~3, // eslint-disable-line no-bitwise
    usage,
    mappedAtCreation: true,
  });
  let writeArary;
  if (array instanceof Int8Array) {
    writeArary = new Int8Array(buffer.getMappedRange());
  } else if (array instanceof Uint8Array) {
    writeArary = new Uint8Array(buffer.getMappedRange());
  } else if (array instanceof Int16Array) {
    writeArary = new Int16Array(buffer.getMappedRange());
  } else if (array instanceof Uint16Array) {
    writeArary = new Uint16Array(buffer.getMappedRange());
  } else if (array instanceof Uint32Array) {
    writeArary = new Uint32Array(buffer.getMappedRange());
  } else {
    writeArary = new Float32Array(buffer.getMappedRange());
  }
  writeArary.set(array);
  buffer.unmap();
  return buffer;
}
