// node_modules/three/build/three.core.js
var REVISION = "185";
var PCFShadowMap = 1;
var VSMShadowMap = 3;
var NeverDepth = 0;
var AlwaysDepth = 1;
var LessDepth = 2;
var LessEqualDepth = 3;
var EqualDepth = 4;
var GreaterEqualDepth = 5;
var GreaterDepth = 6;
var NotEqualDepth = 7;
var MultiplyOperation = 0;
var MixOperation = 1;
var AddOperation = 2;
var LinearToneMapping = 1;
var ReinhardToneMapping = 2;
var CineonToneMapping = 3;
var ACESFilmicToneMapping = 4;
var CustomToneMapping = 5;
var AgXToneMapping = 6;
var NeutralToneMapping = 7;
var UVMapping = 300;
var CubeReflectionMapping = 301;
var CubeRefractionMapping = 302;
var CubeUVReflectionMapping = 306;
var RepeatWrapping = 1000;
var ClampToEdgeWrapping = 1001;
var MirroredRepeatWrapping = 1002;
var LinearFilter = 1006;
var LinearMipmapLinearFilter = 1008;
var UnsignedByteType = 1009;
var FloatType = 1015;
var RGBAFormat = 1023;
var InterpolateDiscrete = 2300;
var InterpolateLinear = 2301;
var InterpolateSmooth = 2302;
var InterpolateBezier = 2303;
var ZeroCurvatureEnding = 2400;
var ZeroSlopeEnding = 2401;
var WrapAroundEnding = 2402;
var NoColorSpace = "";
var SRGBColorSpace = "srgb";
var LinearSRGBColorSpace = "srgb-linear";
var LinearTransfer = "linear";
var SRGBTransfer = "srgb";
var StaticDrawUsage = 35044;
var WebGLCoordinateSystem = 2000;
var WebGPUCoordinateSystem = 2001;
function arrayNeedsUint32(array) {
  for (let i = array.length - 1;i >= 0; --i) {
    if (array[i] >= 65535)
      return true;
  }
  return false;
}
function isTypedArray(array) {
  return ArrayBuffer.isView(array) && !(array instanceof DataView);
}
function createElementNS(name) {
  return document.createElementNS("http://www.w3.org/1999/xhtml", name);
}
var _cache = {};
var _setConsoleFunction = null;
function enhanceLogMessage(params) {
  const message = params[0];
  if (typeof message === "string" && message.startsWith("TSL:")) {
    const stackTrace = params[1];
    if (stackTrace && stackTrace.isStackTrace) {
      params[0] += " " + stackTrace.getLocation();
    } else {
      params[1] = 'Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.';
    }
  }
  return params;
}
function warn(...params) {
  params = enhanceLogMessage(params);
  const message = "THREE." + params.shift();
  if (_setConsoleFunction) {
    _setConsoleFunction("warn", message, ...params);
  } else {
    const stackTrace = params[0];
    if (stackTrace && stackTrace.isStackTrace) {
      console.warn(stackTrace.getError(message));
    } else {
      console.warn(message, ...params);
    }
  }
}
function error(...params) {
  params = enhanceLogMessage(params);
  const message = "THREE." + params.shift();
  if (_setConsoleFunction) {
    _setConsoleFunction("error", message, ...params);
  } else {
    const stackTrace = params[0];
    if (stackTrace && stackTrace.isStackTrace) {
      console.error(stackTrace.getError(message));
    } else {
      console.error(message, ...params);
    }
  }
}
function warnOnce(...params) {
  const message = params.join(" ");
  if (message in _cache)
    return;
  _cache[message] = true;
  warn(...params);
}
var ReversedDepthFuncs = {
  [NeverDepth]: AlwaysDepth,
  [LessDepth]: GreaterDepth,
  [EqualDepth]: NotEqualDepth,
  [LessEqualDepth]: GreaterEqualDepth,
  [AlwaysDepth]: NeverDepth,
  [GreaterDepth]: LessDepth,
  [NotEqualDepth]: EqualDepth,
  [GreaterEqualDepth]: LessEqualDepth
};

class EventDispatcher {
  addEventListener(type, listener) {
    if (this._listeners === undefined)
      this._listeners = {};
    const listeners = this._listeners;
    if (listeners[type] === undefined) {
      listeners[type] = [];
    }
    if (listeners[type].indexOf(listener) === -1) {
      listeners[type].push(listener);
    }
  }
  hasEventListener(type, listener) {
    const listeners = this._listeners;
    if (listeners === undefined)
      return false;
    return listeners[type] !== undefined && listeners[type].indexOf(listener) !== -1;
  }
  removeEventListener(type, listener) {
    const listeners = this._listeners;
    if (listeners === undefined)
      return;
    const listenerArray = listeners[type];
    if (listenerArray !== undefined) {
      const index = listenerArray.indexOf(listener);
      if (index !== -1) {
        listenerArray.splice(index, 1);
      }
    }
  }
  dispatchEvent(event) {
    const listeners = this._listeners;
    if (listeners === undefined)
      return;
    const listenerArray = listeners[event.type];
    if (listenerArray !== undefined) {
      event.target = this;
      const array = listenerArray.slice(0);
      for (let i = 0, l = array.length;i < l; i++) {
        array[i].call(this, event);
      }
      event.target = null;
    }
  }
}
var _lut = ["00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "0a", "0b", "0c", "0d", "0e", "0f", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "1a", "1b", "1c", "1d", "1e", "1f", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "2a", "2b", "2c", "2d", "2e", "2f", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "3a", "3b", "3c", "3d", "3e", "3f", "40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "4a", "4b", "4c", "4d", "4e", "4f", "50", "51", "52", "53", "54", "55", "56", "57", "58", "59", "5a", "5b", "5c", "5d", "5e", "5f", "60", "61", "62", "63", "64", "65", "66", "67", "68", "69", "6a", "6b", "6c", "6d", "6e", "6f", "70", "71", "72", "73", "74", "75", "76", "77", "78", "79", "7a", "7b", "7c", "7d", "7e", "7f", "80", "81", "82", "83", "84", "85", "86", "87", "88", "89", "8a", "8b", "8c", "8d", "8e", "8f", "90", "91", "92", "93", "94", "95", "96", "97", "98", "99", "9a", "9b", "9c", "9d", "9e", "9f", "a0", "a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "aa", "ab", "ac", "ad", "ae", "af", "b0", "b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8", "b9", "ba", "bb", "bc", "bd", "be", "bf", "c0", "c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "ca", "cb", "cc", "cd", "ce", "cf", "d0", "d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8", "d9", "da", "db", "dc", "dd", "de", "df", "e0", "e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8", "e9", "ea", "eb", "ec", "ed", "ee", "ef", "f0", "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "fa", "fb", "fc", "fd", "fe", "ff"];
var DEG2RAD = Math.PI / 180;
var RAD2DEG = 180 / Math.PI;
function generateUUID() {
  const d0 = Math.random() * 4294967295 | 0;
  const d1 = Math.random() * 4294967295 | 0;
  const d2 = Math.random() * 4294967295 | 0;
  const d3 = Math.random() * 4294967295 | 0;
  const uuid = _lut[d0 & 255] + _lut[d0 >> 8 & 255] + _lut[d0 >> 16 & 255] + _lut[d0 >> 24 & 255] + "-" + _lut[d1 & 255] + _lut[d1 >> 8 & 255] + "-" + _lut[d1 >> 16 & 15 | 64] + _lut[d1 >> 24 & 255] + "-" + _lut[d2 & 63 | 128] + _lut[d2 >> 8 & 255] + "-" + _lut[d2 >> 16 & 255] + _lut[d2 >> 24 & 255] + _lut[d3 & 255] + _lut[d3 >> 8 & 255] + _lut[d3 >> 16 & 255] + _lut[d3 >> 24 & 255];
  return uuid.toLowerCase();
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function euclideanModulo(n, m) {
  return (n % m + m) % m;
}
function lerp(x, y, t) {
  return (1 - t) * x + t * y;
}
function denormalize(value, array) {
  switch (array.constructor) {
    case Float32Array:
      return value;
    case Uint32Array:
      return value / 4294967295;
    case Uint16Array:
      return value / 65535;
    case Uint8Array:
      return value / 255;
    case Int32Array:
      return Math.max(value / 2147483647, -1);
    case Int16Array:
      return Math.max(value / 32767, -1);
    case Int8Array:
      return Math.max(value / 127, -1);
    default:
      throw new Error("THREE.MathUtils: Invalid component type.");
  }
}
function normalize(value, array) {
  switch (array.constructor) {
    case Float32Array:
      return value;
    case Uint32Array:
      return Math.round(value * 4294967295);
    case Uint16Array:
      return Math.round(value * 65535);
    case Uint8Array:
      return Math.round(value * 255);
    case Int32Array:
      return Math.round(value * 2147483647);
    case Int16Array:
      return Math.round(value * 32767);
    case Int8Array:
      return Math.round(value * 127);
    default:
      throw new Error("THREE.MathUtils: Invalid component type.");
  }
}
class Vector2 {
  static {
    Vector2.prototype.isVector2 = true;
  }
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  get width() {
    return this.x;
  }
  set width(value) {
    this.x = value;
  }
  get height() {
    return this.y;
  }
  set height(value) {
    this.y = value;
  }
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }
  setScalar(scalar) {
    this.x = scalar;
    this.y = scalar;
    return this;
  }
  setX(x) {
    this.x = x;
    return this;
  }
  setY(y) {
    this.y = y;
    return this;
  }
  setComponent(index, value) {
    switch (index) {
      case 0:
        this.x = value;
        break;
      case 1:
        this.y = value;
        break;
      default:
        throw new Error("THREE.Vector2: index is out of range: " + index);
    }
    return this;
  }
  getComponent(index) {
    switch (index) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      default:
        throw new Error("THREE.Vector2: index is out of range: " + index);
    }
  }
  clone() {
    return new this.constructor(this.x, this.y);
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    return this;
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }
  addScalar(s) {
    this.x += s;
    this.y += s;
    return this;
  }
  addVectors(a, b) {
    this.x = a.x + b.x;
    this.y = a.y + b.y;
    return this;
  }
  addScaledVector(v, s) {
    this.x += v.x * s;
    this.y += v.y * s;
    return this;
  }
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }
  subScalar(s) {
    this.x -= s;
    this.y -= s;
    return this;
  }
  subVectors(a, b) {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    return this;
  }
  multiply(v) {
    this.x *= v.x;
    this.y *= v.y;
    return this;
  }
  multiplyScalar(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }
  divide(v) {
    this.x /= v.x;
    this.y /= v.y;
    return this;
  }
  divideScalar(scalar) {
    return this.multiplyScalar(1 / scalar);
  }
  applyMatrix3(m) {
    const x = this.x, y = this.y;
    const e = m.elements;
    this.x = e[0] * x + e[3] * y + e[6];
    this.y = e[1] * x + e[4] * y + e[7];
    return this;
  }
  min(v) {
    this.x = Math.min(this.x, v.x);
    this.y = Math.min(this.y, v.y);
    return this;
  }
  max(v) {
    this.x = Math.max(this.x, v.x);
    this.y = Math.max(this.y, v.y);
    return this;
  }
  clamp(min, max) {
    this.x = clamp(this.x, min.x, max.x);
    this.y = clamp(this.y, min.y, max.y);
    return this;
  }
  clampScalar(minVal, maxVal) {
    this.x = clamp(this.x, minVal, maxVal);
    this.y = clamp(this.y, minVal, maxVal);
    return this;
  }
  clampLength(min, max) {
    const length = this.length();
    return this.divideScalar(length || 1).multiplyScalar(clamp(length, min, max));
  }
  floor() {
    this.x = Math.floor(this.x);
    this.y = Math.floor(this.y);
    return this;
  }
  ceil() {
    this.x = Math.ceil(this.x);
    this.y = Math.ceil(this.y);
    return this;
  }
  round() {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    return this;
  }
  roundToZero() {
    this.x = Math.trunc(this.x);
    this.y = Math.trunc(this.y);
    return this;
  }
  negate() {
    this.x = -this.x;
    this.y = -this.y;
    return this;
  }
  dot(v) {
    return this.x * v.x + this.y * v.y;
  }
  cross(v) {
    return this.x * v.y - this.y * v.x;
  }
  lengthSq() {
    return this.x * this.x + this.y * this.y;
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  manhattanLength() {
    return Math.abs(this.x) + Math.abs(this.y);
  }
  normalize() {
    return this.divideScalar(this.length() || 1);
  }
  angle() {
    const angle = Math.atan2(-this.y, -this.x) + Math.PI;
    return angle;
  }
  angleTo(v) {
    const denominator = Math.sqrt(this.lengthSq() * v.lengthSq());
    if (denominator === 0)
      return Math.PI / 2;
    const theta = this.dot(v) / denominator;
    return Math.acos(clamp(theta, -1, 1));
  }
  distanceTo(v) {
    return Math.sqrt(this.distanceToSquared(v));
  }
  distanceToSquared(v) {
    const dx = this.x - v.x, dy = this.y - v.y;
    return dx * dx + dy * dy;
  }
  manhattanDistanceTo(v) {
    return Math.abs(this.x - v.x) + Math.abs(this.y - v.y);
  }
  setLength(length) {
    return this.normalize().multiplyScalar(length);
  }
  lerp(v, alpha) {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    return this;
  }
  lerpVectors(v1, v2, alpha) {
    this.x = v1.x + (v2.x - v1.x) * alpha;
    this.y = v1.y + (v2.y - v1.y) * alpha;
    return this;
  }
  equals(v) {
    return v.x === this.x && v.y === this.y;
  }
  fromArray(array, offset = 0) {
    this.x = array[offset];
    this.y = array[offset + 1];
    return this;
  }
  toArray(array = [], offset = 0) {
    array[offset] = this.x;
    array[offset + 1] = this.y;
    return array;
  }
  fromBufferAttribute(attribute, index) {
    this.x = attribute.getX(index);
    this.y = attribute.getY(index);
    return this;
  }
  rotateAround(center, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const x = this.x - center.x;
    const y = this.y - center.y;
    this.x = x * c - y * s + center.x;
    this.y = x * s + y * c + center.y;
    return this;
  }
  random() {
    this.x = Math.random();
    this.y = Math.random();
    return this;
  }
  *[Symbol.iterator]() {
    yield this.x;
    yield this.y;
  }
}

class Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.isQuaternion = true;
    this._x = x;
    this._y = y;
    this._z = z;
    this._w = w;
  }
  static slerpFlat(dst, dstOffset, src0, srcOffset0, src1, srcOffset1, t) {
    let x0 = src0[srcOffset0 + 0], y0 = src0[srcOffset0 + 1], z0 = src0[srcOffset0 + 2], w0 = src0[srcOffset0 + 3];
    let x1 = src1[srcOffset1 + 0], y1 = src1[srcOffset1 + 1], z1 = src1[srcOffset1 + 2], w1 = src1[srcOffset1 + 3];
    if (w0 !== w1 || x0 !== x1 || y0 !== y1 || z0 !== z1) {
      let dot = x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1;
      if (dot < 0) {
        x1 = -x1;
        y1 = -y1;
        z1 = -z1;
        w1 = -w1;
        dot = -dot;
      }
      let s = 1 - t;
      if (dot < 0.9995) {
        const theta = Math.acos(dot);
        const sin = Math.sin(theta);
        s = Math.sin(s * theta) / sin;
        t = Math.sin(t * theta) / sin;
        x0 = x0 * s + x1 * t;
        y0 = y0 * s + y1 * t;
        z0 = z0 * s + z1 * t;
        w0 = w0 * s + w1 * t;
      } else {
        x0 = x0 * s + x1 * t;
        y0 = y0 * s + y1 * t;
        z0 = z0 * s + z1 * t;
        w0 = w0 * s + w1 * t;
        const f = 1 / Math.sqrt(x0 * x0 + y0 * y0 + z0 * z0 + w0 * w0);
        x0 *= f;
        y0 *= f;
        z0 *= f;
        w0 *= f;
      }
    }
    dst[dstOffset] = x0;
    dst[dstOffset + 1] = y0;
    dst[dstOffset + 2] = z0;
    dst[dstOffset + 3] = w0;
  }
  static multiplyQuaternionsFlat(dst, dstOffset, src0, srcOffset0, src1, srcOffset1) {
    const x0 = src0[srcOffset0];
    const y0 = src0[srcOffset0 + 1];
    const z0 = src0[srcOffset0 + 2];
    const w0 = src0[srcOffset0 + 3];
    const x1 = src1[srcOffset1];
    const y1 = src1[srcOffset1 + 1];
    const z1 = src1[srcOffset1 + 2];
    const w1 = src1[srcOffset1 + 3];
    dst[dstOffset] = x0 * w1 + w0 * x1 + y0 * z1 - z0 * y1;
    dst[dstOffset + 1] = y0 * w1 + w0 * y1 + z0 * x1 - x0 * z1;
    dst[dstOffset + 2] = z0 * w1 + w0 * z1 + x0 * y1 - y0 * x1;
    dst[dstOffset + 3] = w0 * w1 - x0 * x1 - y0 * y1 - z0 * z1;
    return dst;
  }
  get x() {
    return this._x;
  }
  set x(value) {
    this._x = value;
    this._onChangeCallback();
  }
  get y() {
    return this._y;
  }
  set y(value) {
    this._y = value;
    this._onChangeCallback();
  }
  get z() {
    return this._z;
  }
  set z(value) {
    this._z = value;
    this._onChangeCallback();
  }
  get w() {
    return this._w;
  }
  set w(value) {
    this._w = value;
    this._onChangeCallback();
  }
  set(x, y, z, w) {
    this._x = x;
    this._y = y;
    this._z = z;
    this._w = w;
    this._onChangeCallback();
    return this;
  }
  clone() {
    return new this.constructor(this._x, this._y, this._z, this._w);
  }
  copy(quaternion) {
    this._x = quaternion.x;
    this._y = quaternion.y;
    this._z = quaternion.z;
    this._w = quaternion.w;
    this._onChangeCallback();
    return this;
  }
  setFromEuler(euler, update = true) {
    const { _x: x, _y: y, _z: z, _order: order } = euler;
    const cos = Math.cos;
    const sin = Math.sin;
    const c1 = cos(x / 2);
    const c2 = cos(y / 2);
    const c3 = cos(z / 2);
    const s1 = sin(x / 2);
    const s2 = sin(y / 2);
    const s3 = sin(z / 2);
    switch (order) {
      case "XYZ":
        this._x = s1 * c2 * c3 + c1 * s2 * s3;
        this._y = c1 * s2 * c3 - s1 * c2 * s3;
        this._z = c1 * c2 * s3 + s1 * s2 * c3;
        this._w = c1 * c2 * c3 - s1 * s2 * s3;
        break;
      case "YXZ":
        this._x = s1 * c2 * c3 + c1 * s2 * s3;
        this._y = c1 * s2 * c3 - s1 * c2 * s3;
        this._z = c1 * c2 * s3 - s1 * s2 * c3;
        this._w = c1 * c2 * c3 + s1 * s2 * s3;
        break;
      case "ZXY":
        this._x = s1 * c2 * c3 - c1 * s2 * s3;
        this._y = c1 * s2 * c3 + s1 * c2 * s3;
        this._z = c1 * c2 * s3 + s1 * s2 * c3;
        this._w = c1 * c2 * c3 - s1 * s2 * s3;
        break;
      case "ZYX":
        this._x = s1 * c2 * c3 - c1 * s2 * s3;
        this._y = c1 * s2 * c3 + s1 * c2 * s3;
        this._z = c1 * c2 * s3 - s1 * s2 * c3;
        this._w = c1 * c2 * c3 + s1 * s2 * s3;
        break;
      case "YZX":
        this._x = s1 * c2 * c3 + c1 * s2 * s3;
        this._y = c1 * s2 * c3 + s1 * c2 * s3;
        this._z = c1 * c2 * s3 - s1 * s2 * c3;
        this._w = c1 * c2 * c3 - s1 * s2 * s3;
        break;
      case "XZY":
        this._x = s1 * c2 * c3 - c1 * s2 * s3;
        this._y = c1 * s2 * c3 - s1 * c2 * s3;
        this._z = c1 * c2 * s3 + s1 * s2 * c3;
        this._w = c1 * c2 * c3 + s1 * s2 * s3;
        break;
      default:
        warn("Quaternion: .setFromEuler() encountered an unknown order: " + order);
    }
    if (update === true)
      this._onChangeCallback();
    return this;
  }
  setFromAxisAngle(axis, angle) {
    const halfAngle = angle / 2, s = Math.sin(halfAngle);
    this._x = axis.x * s;
    this._y = axis.y * s;
    this._z = axis.z * s;
    this._w = Math.cos(halfAngle);
    this._onChangeCallback();
    return this;
  }
  setFromRotationMatrix(m) {
    const te = m.elements, m11 = te[0], m12 = te[4], m13 = te[8], m21 = te[1], m22 = te[5], m23 = te[9], m31 = te[2], m32 = te[6], m33 = te[10], trace = m11 + m22 + m33;
    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1);
      this._w = 0.25 / s;
      this._x = (m32 - m23) * s;
      this._y = (m13 - m31) * s;
      this._z = (m21 - m12) * s;
    } else if (m11 > m22 && m11 > m33) {
      const s = 2 * Math.sqrt(1 + m11 - m22 - m33);
      this._w = (m32 - m23) / s;
      this._x = 0.25 * s;
      this._y = (m12 + m21) / s;
      this._z = (m13 + m31) / s;
    } else if (m22 > m33) {
      const s = 2 * Math.sqrt(1 + m22 - m11 - m33);
      this._w = (m13 - m31) / s;
      this._x = (m12 + m21) / s;
      this._y = 0.25 * s;
      this._z = (m23 + m32) / s;
    } else {
      const s = 2 * Math.sqrt(1 + m33 - m11 - m22);
      this._w = (m21 - m12) / s;
      this._x = (m13 + m31) / s;
      this._y = (m23 + m32) / s;
      this._z = 0.25 * s;
    }
    this._onChangeCallback();
    return this;
  }
  setFromUnitVectors(vFrom, vTo) {
    let r = vFrom.dot(vTo) + 1;
    if (r < 0.00000001) {
      r = 0;
      if (Math.abs(vFrom.x) > Math.abs(vFrom.z)) {
        this._x = -vFrom.y;
        this._y = vFrom.x;
        this._z = 0;
        this._w = r;
      } else {
        this._x = 0;
        this._y = -vFrom.z;
        this._z = vFrom.y;
        this._w = r;
      }
    } else {
      this._x = vFrom.y * vTo.z - vFrom.z * vTo.y;
      this._y = vFrom.z * vTo.x - vFrom.x * vTo.z;
      this._z = vFrom.x * vTo.y - vFrom.y * vTo.x;
      this._w = r;
    }
    return this.normalize();
  }
  angleTo(q) {
    return 2 * Math.acos(Math.abs(clamp(this.dot(q), -1, 1)));
  }
  rotateTowards(q, step) {
    const angle = this.angleTo(q);
    if (angle === 0)
      return this;
    const t = Math.min(1, step / angle);
    this.slerp(q, t);
    return this;
  }
  identity() {
    return this.set(0, 0, 0, 1);
  }
  invert() {
    return this.conjugate();
  }
  conjugate() {
    this._x *= -1;
    this._y *= -1;
    this._z *= -1;
    this._onChangeCallback();
    return this;
  }
  dot(v) {
    return this._x * v._x + this._y * v._y + this._z * v._z + this._w * v._w;
  }
  lengthSq() {
    return this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w;
  }
  length() {
    return Math.sqrt(this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w);
  }
  normalize() {
    let l = this.length();
    if (l === 0) {
      this._x = 0;
      this._y = 0;
      this._z = 0;
      this._w = 1;
    } else {
      l = 1 / l;
      this._x = this._x * l;
      this._y = this._y * l;
      this._z = this._z * l;
      this._w = this._w * l;
    }
    this._onChangeCallback();
    return this;
  }
  multiply(q) {
    return this.multiplyQuaternions(this, q);
  }
  premultiply(q) {
    return this.multiplyQuaternions(q, this);
  }
  multiplyQuaternions(a, b) {
    const { _x: qax, _y: qay, _z: qaz, _w: qaw } = a;
    const { _x: qbx, _y: qby, _z: qbz, _w: qbw } = b;
    this._x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
    this._y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
    this._z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
    this._w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;
    this._onChangeCallback();
    return this;
  }
  slerp(qb, t) {
    let { _x: x, _y: y, _z: z, _w: w } = qb;
    let dot = this.dot(qb);
    if (dot < 0) {
      x = -x;
      y = -y;
      z = -z;
      w = -w;
      dot = -dot;
    }
    let s = 1 - t;
    if (dot < 0.9995) {
      const theta = Math.acos(dot);
      const sin = Math.sin(theta);
      s = Math.sin(s * theta) / sin;
      t = Math.sin(t * theta) / sin;
      this._x = this._x * s + x * t;
      this._y = this._y * s + y * t;
      this._z = this._z * s + z * t;
      this._w = this._w * s + w * t;
      this._onChangeCallback();
    } else {
      this._x = this._x * s + x * t;
      this._y = this._y * s + y * t;
      this._z = this._z * s + z * t;
      this._w = this._w * s + w * t;
      this.normalize();
    }
    return this;
  }
  slerpQuaternions(qa, qb, t) {
    return this.copy(qa).slerp(qb, t);
  }
  random() {
    const theta1 = 2 * Math.PI * Math.random();
    const theta2 = 2 * Math.PI * Math.random();
    const x0 = Math.random();
    const r1 = Math.sqrt(1 - x0);
    const r2 = Math.sqrt(x0);
    return this.set(r1 * Math.sin(theta1), r1 * Math.cos(theta1), r2 * Math.sin(theta2), r2 * Math.cos(theta2));
  }
  equals(quaternion) {
    return quaternion._x === this._x && quaternion._y === this._y && quaternion._z === this._z && quaternion._w === this._w;
  }
  fromArray(array, offset = 0) {
    this._x = array[offset];
    this._y = array[offset + 1];
    this._z = array[offset + 2];
    this._w = array[offset + 3];
    this._onChangeCallback();
    return this;
  }
  toArray(array = [], offset = 0) {
    array[offset] = this._x;
    array[offset + 1] = this._y;
    array[offset + 2] = this._z;
    array[offset + 3] = this._w;
    return array;
  }
  fromBufferAttribute(attribute, index) {
    this._x = attribute.getX(index);
    this._y = attribute.getY(index);
    this._z = attribute.getZ(index);
    this._w = attribute.getW(index);
    this._onChangeCallback();
    return this;
  }
  toJSON() {
    return this.toArray();
  }
  _onChange(callback) {
    this._onChangeCallback = callback;
    return this;
  }
  _onChangeCallback() {}
  *[Symbol.iterator]() {
    yield this._x;
    yield this._y;
    yield this._z;
    yield this._w;
  }
}

class Vector3 {
  static {
    Vector3.prototype.isVector3 = true;
  }
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x, y, z) {
    if (z === undefined)
      z = this.z;
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  setScalar(scalar) {
    this.x = scalar;
    this.y = scalar;
    this.z = scalar;
    return this;
  }
  setX(x) {
    this.x = x;
    return this;
  }
  setY(y) {
    this.y = y;
    return this;
  }
  setZ(z) {
    this.z = z;
    return this;
  }
  setComponent(index, value) {
    switch (index) {
      case 0:
        this.x = value;
        break;
      case 1:
        this.y = value;
        break;
      case 2:
        this.z = value;
        break;
      default:
        throw new Error("THREE.Vector3: index is out of range: " + index);
    }
    return this;
  }
  getComponent(index) {
    switch (index) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      case 2:
        return this.z;
      default:
        throw new Error("THREE.Vector3: index is out of range: " + index);
    }
  }
  clone() {
    return new this.constructor(this.x, this.y, this.z);
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  addScalar(s) {
    this.x += s;
    this.y += s;
    this.z += s;
    return this;
  }
  addVectors(a, b) {
    this.x = a.x + b.x;
    this.y = a.y + b.y;
    this.z = a.z + b.z;
    return this;
  }
  addScaledVector(v, s) {
    this.x += v.x * s;
    this.y += v.y * s;
    this.z += v.z * s;
    return this;
  }
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }
  subScalar(s) {
    this.x -= s;
    this.y -= s;
    this.z -= s;
    return this;
  }
  subVectors(a, b) {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    this.z = a.z - b.z;
    return this;
  }
  multiply(v) {
    this.x *= v.x;
    this.y *= v.y;
    this.z *= v.z;
    return this;
  }
  multiplyScalar(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this;
  }
  multiplyVectors(a, b) {
    this.x = a.x * b.x;
    this.y = a.y * b.y;
    this.z = a.z * b.z;
    return this;
  }
  applyEuler(euler) {
    return this.applyQuaternion(_quaternion$5.setFromEuler(euler));
  }
  applyAxisAngle(axis, angle) {
    return this.applyQuaternion(_quaternion$5.setFromAxisAngle(axis, angle));
  }
  applyMatrix3(m) {
    const x = this.x, y = this.y, z = this.z;
    const e = m.elements;
    this.x = e[0] * x + e[3] * y + e[6] * z;
    this.y = e[1] * x + e[4] * y + e[7] * z;
    this.z = e[2] * x + e[5] * y + e[8] * z;
    return this;
  }
  applyNormalMatrix(m) {
    return this.applyMatrix3(m).normalize();
  }
  applyMatrix4(m) {
    const x = this.x, y = this.y, z = this.z;
    const e = m.elements;
    const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
    this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
    return this;
  }
  applyQuaternion(q) {
    const vx = this.x, vy = this.y, vz = this.z;
    const { x: qx, y: qy, z: qz, w: qw } = q;
    const tx = 2 * (qy * vz - qz * vy);
    const ty = 2 * (qz * vx - qx * vz);
    const tz = 2 * (qx * vy - qy * vx);
    this.x = vx + qw * tx + qy * tz - qz * ty;
    this.y = vy + qw * ty + qz * tx - qx * tz;
    this.z = vz + qw * tz + qx * ty - qy * tx;
    return this;
  }
  project(camera) {
    return this.applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
  }
  unproject(camera) {
    return this.applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);
  }
  transformDirection(m) {
    const x = this.x, y = this.y, z = this.z;
    const e = m.elements;
    this.x = e[0] * x + e[4] * y + e[8] * z;
    this.y = e[1] * x + e[5] * y + e[9] * z;
    this.z = e[2] * x + e[6] * y + e[10] * z;
    return this.normalize();
  }
  divide(v) {
    this.x /= v.x;
    this.y /= v.y;
    this.z /= v.z;
    return this;
  }
  divideScalar(scalar) {
    return this.multiplyScalar(1 / scalar);
  }
  min(v) {
    this.x = Math.min(this.x, v.x);
    this.y = Math.min(this.y, v.y);
    this.z = Math.min(this.z, v.z);
    return this;
  }
  max(v) {
    this.x = Math.max(this.x, v.x);
    this.y = Math.max(this.y, v.y);
    this.z = Math.max(this.z, v.z);
    return this;
  }
  clamp(min, max) {
    this.x = clamp(this.x, min.x, max.x);
    this.y = clamp(this.y, min.y, max.y);
    this.z = clamp(this.z, min.z, max.z);
    return this;
  }
  clampScalar(minVal, maxVal) {
    this.x = clamp(this.x, minVal, maxVal);
    this.y = clamp(this.y, minVal, maxVal);
    this.z = clamp(this.z, minVal, maxVal);
    return this;
  }
  clampLength(min, max) {
    const length = this.length();
    return this.divideScalar(length || 1).multiplyScalar(clamp(length, min, max));
  }
  floor() {
    this.x = Math.floor(this.x);
    this.y = Math.floor(this.y);
    this.z = Math.floor(this.z);
    return this;
  }
  ceil() {
    this.x = Math.ceil(this.x);
    this.y = Math.ceil(this.y);
    this.z = Math.ceil(this.z);
    return this;
  }
  round() {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    this.z = Math.round(this.z);
    return this;
  }
  roundToZero() {
    this.x = Math.trunc(this.x);
    this.y = Math.trunc(this.y);
    this.z = Math.trunc(this.z);
    return this;
  }
  negate() {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    return this;
  }
  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
  manhattanLength() {
    return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z);
  }
  normalize() {
    return this.divideScalar(this.length() || 1);
  }
  setLength(length) {
    return this.normalize().multiplyScalar(length);
  }
  lerp(v, alpha) {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    this.z += (v.z - this.z) * alpha;
    return this;
  }
  lerpVectors(v1, v2, alpha) {
    this.x = v1.x + (v2.x - v1.x) * alpha;
    this.y = v1.y + (v2.y - v1.y) * alpha;
    this.z = v1.z + (v2.z - v1.z) * alpha;
    return this;
  }
  cross(v) {
    return this.crossVectors(this, v);
  }
  crossVectors(a, b) {
    const { x: ax, y: ay, z: az } = a;
    const { x: bx, y: by, z: bz } = b;
    this.x = ay * bz - az * by;
    this.y = az * bx - ax * bz;
    this.z = ax * by - ay * bx;
    return this;
  }
  projectOnVector(v) {
    const denominator = v.lengthSq();
    if (denominator === 0)
      return this.set(0, 0, 0);
    const scalar = v.dot(this) / denominator;
    return this.copy(v).multiplyScalar(scalar);
  }
  projectOnPlane(planeNormal) {
    _vector$c.copy(this).projectOnVector(planeNormal);
    return this.sub(_vector$c);
  }
  reflect(normal) {
    return this.sub(_vector$c.copy(normal).multiplyScalar(2 * this.dot(normal)));
  }
  angleTo(v) {
    const denominator = Math.sqrt(this.lengthSq() * v.lengthSq());
    if (denominator === 0)
      return Math.PI / 2;
    const theta = this.dot(v) / denominator;
    return Math.acos(clamp(theta, -1, 1));
  }
  distanceTo(v) {
    return Math.sqrt(this.distanceToSquared(v));
  }
  distanceToSquared(v) {
    const dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z;
    return dx * dx + dy * dy + dz * dz;
  }
  manhattanDistanceTo(v) {
    return Math.abs(this.x - v.x) + Math.abs(this.y - v.y) + Math.abs(this.z - v.z);
  }
  setFromSpherical(s) {
    return this.setFromSphericalCoords(s.radius, s.phi, s.theta);
  }
  setFromSphericalCoords(radius, phi, theta) {
    const sinPhiRadius = Math.sin(phi) * radius;
    this.x = sinPhiRadius * Math.sin(theta);
    this.y = Math.cos(phi) * radius;
    this.z = sinPhiRadius * Math.cos(theta);
    return this;
  }
  setFromCylindrical(c) {
    return this.setFromCylindricalCoords(c.radius, c.theta, c.y);
  }
  setFromCylindricalCoords(radius, theta, y) {
    this.x = radius * Math.sin(theta);
    this.y = y;
    this.z = radius * Math.cos(theta);
    return this;
  }
  setFromMatrixPosition(m) {
    const e = m.elements;
    this.x = e[12];
    this.y = e[13];
    this.z = e[14];
    return this;
  }
  setFromMatrixScale(m) {
    const sx = this.setFromMatrixColumn(m, 0).length();
    const sy = this.setFromMatrixColumn(m, 1).length();
    const sz = this.setFromMatrixColumn(m, 2).length();
    this.x = sx;
    this.y = sy;
    this.z = sz;
    return this;
  }
  setFromMatrixColumn(m, index) {
    return this.fromArray(m.elements, index * 4);
  }
  setFromMatrix3Column(m, index) {
    return this.fromArray(m.elements, index * 3);
  }
  setFromEuler(e) {
    this.x = e._x;
    this.y = e._y;
    this.z = e._z;
    return this;
  }
  setFromColor(c) {
    this.x = c.r;
    this.y = c.g;
    this.z = c.b;
    return this;
  }
  equals(v) {
    return v.x === this.x && v.y === this.y && v.z === this.z;
  }
  fromArray(array, offset = 0) {
    this.x = array[offset];
    this.y = array[offset + 1];
    this.z = array[offset + 2];
    return this;
  }
  toArray(array = [], offset = 0) {
    array[offset] = this.x;
    array[offset + 1] = this.y;
    array[offset + 2] = this.z;
    return array;
  }
  fromBufferAttribute(attribute, index) {
    this.x = attribute.getX(index);
    this.y = attribute.getY(index);
    this.z = attribute.getZ(index);
    return this;
  }
  random() {
    this.x = Math.random();
    this.y = Math.random();
    this.z = Math.random();
    return this;
  }
  randomDirection() {
    const theta = Math.random() * Math.PI * 2;
    const u = Math.random() * 2 - 1;
    const c = Math.sqrt(1 - u * u);
    this.x = c * Math.cos(theta);
    this.y = u;
    this.z = c * Math.sin(theta);
    return this;
  }
  *[Symbol.iterator]() {
    yield this.x;
    yield this.y;
    yield this.z;
  }
}
var _vector$c = /* @__PURE__ */ new Vector3;
var _quaternion$5 = /* @__PURE__ */ new Quaternion;

class Matrix3 {
  static {
    Matrix3.prototype.isMatrix3 = true;
  }
  constructor(n11, n12, n13, n21, n22, n23, n31, n32, n33) {
    this.elements = [
      1,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      1
    ];
    if (n11 !== undefined) {
      this.set(n11, n12, n13, n21, n22, n23, n31, n32, n33);
    }
  }
  set(n11, n12, n13, n21, n22, n23, n31, n32, n33) {
    const te = this.elements;
    te[0] = n11;
    te[1] = n21;
    te[2] = n31;
    te[3] = n12;
    te[4] = n22;
    te[5] = n32;
    te[6] = n13;
    te[7] = n23;
    te[8] = n33;
    return this;
  }
  identity() {
    this.set(1, 0, 0, 0, 1, 0, 0, 0, 1);
    return this;
  }
  copy(m) {
    const te = this.elements;
    const me = m.elements;
    te[0] = me[0];
    te[1] = me[1];
    te[2] = me[2];
    te[3] = me[3];
    te[4] = me[4];
    te[5] = me[5];
    te[6] = me[6];
    te[7] = me[7];
    te[8] = me[8];
    return this;
  }
  extractBasis(xAxis, yAxis, zAxis) {
    xAxis.setFromMatrix3Column(this, 0);
    yAxis.setFromMatrix3Column(this, 1);
    zAxis.setFromMatrix3Column(this, 2);
    return this;
  }
  setFromMatrix4(m) {
    const me = m.elements;
    this.set(me[0], me[4], me[8], me[1], me[5], me[9], me[2], me[6], me[10]);
    return this;
  }
  multiply(m) {
    return this.multiplyMatrices(this, m);
  }
  premultiply(m) {
    return this.multiplyMatrices(m, this);
  }
  multiplyMatrices(a, b) {
    const ae = a.elements;
    const be = b.elements;
    const te = this.elements;
    const a11 = ae[0], a12 = ae[3], a13 = ae[6];
    const a21 = ae[1], a22 = ae[4], a23 = ae[7];
    const a31 = ae[2], a32 = ae[5], a33 = ae[8];
    const b11 = be[0], b12 = be[3], b13 = be[6];
    const b21 = be[1], b22 = be[4], b23 = be[7];
    const b31 = be[2], b32 = be[5], b33 = be[8];
    te[0] = a11 * b11 + a12 * b21 + a13 * b31;
    te[3] = a11 * b12 + a12 * b22 + a13 * b32;
    te[6] = a11 * b13 + a12 * b23 + a13 * b33;
    te[1] = a21 * b11 + a22 * b21 + a23 * b31;
    te[4] = a21 * b12 + a22 * b22 + a23 * b32;
    te[7] = a21 * b13 + a22 * b23 + a23 * b33;
    te[2] = a31 * b11 + a32 * b21 + a33 * b31;
    te[5] = a31 * b12 + a32 * b22 + a33 * b32;
    te[8] = a31 * b13 + a32 * b23 + a33 * b33;
    return this;
  }
  multiplyScalar(s) {
    const te = this.elements;
    te[0] *= s;
    te[3] *= s;
    te[6] *= s;
    te[1] *= s;
    te[4] *= s;
    te[7] *= s;
    te[2] *= s;
    te[5] *= s;
    te[8] *= s;
    return this;
  }
  determinant() {
    const te = this.elements;
    const a = te[0], b = te[1], c = te[2], d = te[3], e = te[4], f = te[5], g = te[6], h = te[7], i = te[8];
    return a * e * i - a * f * h - b * d * i + b * f * g + c * d * h - c * e * g;
  }
  invert() {
    const te = this.elements, n11 = te[0], n21 = te[1], n31 = te[2], n12 = te[3], n22 = te[4], n32 = te[5], n13 = te[6], n23 = te[7], n33 = te[8], t11 = n33 * n22 - n32 * n23, t12 = n32 * n13 - n33 * n12, t13 = n23 * n12 - n22 * n13, det = n11 * t11 + n21 * t12 + n31 * t13;
    if (det === 0)
      return this.set(0, 0, 0, 0, 0, 0, 0, 0, 0);
    const detInv = 1 / det;
    te[0] = t11 * detInv;
    te[1] = (n31 * n23 - n33 * n21) * detInv;
    te[2] = (n32 * n21 - n31 * n22) * detInv;
    te[3] = t12 * detInv;
    te[4] = (n33 * n11 - n31 * n13) * detInv;
    te[5] = (n31 * n12 - n32 * n11) * detInv;
    te[6] = t13 * detInv;
    te[7] = (n21 * n13 - n23 * n11) * detInv;
    te[8] = (n22 * n11 - n21 * n12) * detInv;
    return this;
  }
  transpose() {
    let tmp;
    const m = this.elements;
    tmp = m[1];
    m[1] = m[3];
    m[3] = tmp;
    tmp = m[2];
    m[2] = m[6];
    m[6] = tmp;
    tmp = m[5];
    m[5] = m[7];
    m[7] = tmp;
    return this;
  }
  getNormalMatrix(matrix4) {
    return this.setFromMatrix4(matrix4).invert().transpose();
  }
  transposeIntoArray(r) {
    const m = this.elements;
    r[0] = m[0];
    r[1] = m[3];
    r[2] = m[6];
    r[3] = m[1];
    r[4] = m[4];
    r[5] = m[7];
    r[6] = m[2];
    r[7] = m[5];
    r[8] = m[8];
    return this;
  }
  setUvTransform(tx, ty, sx, sy, rotation, cx, cy) {
    const c = Math.cos(rotation);
    const s = Math.sin(rotation);
    this.set(sx * c, sx * s, -sx * (c * cx + s * cy) + cx + tx, -sy * s, sy * c, -sy * (-s * cx + c * cy) + cy + ty, 0, 0, 1);
    return this;
  }
  scale(sx, sy) {
    warnOnce("Matrix3: .scale() is deprecated. Use .makeScale() instead.");
    this.premultiply(_m3.makeScale(sx, sy));
    return this;
  }
  rotate(theta) {
    warnOnce("Matrix3: .rotate() is deprecated. Use .makeRotation() instead.");
    this.premultiply(_m3.makeRotation(-theta));
    return this;
  }
  translate(tx, ty) {
    warnOnce("Matrix3: .translate() is deprecated. Use .makeTranslation() instead.");
    this.premultiply(_m3.makeTranslation(tx, ty));
    return this;
  }
  makeTranslation(x, y) {
    if (x.isVector2) {
      this.set(1, 0, x.x, 0, 1, x.y, 0, 0, 1);
    } else {
      this.set(1, 0, x, 0, 1, y, 0, 0, 1);
    }
    return this;
  }
  makeRotation(theta) {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    this.set(c, -s, 0, s, c, 0, 0, 0, 1);
    return this;
  }
  makeScale(x, y) {
    this.set(x, 0, 0, 0, y, 0, 0, 0, 1);
    return this;
  }
  equals(matrix) {
    const te = this.elements;
    const me = matrix.elements;
    for (let i = 0;i < 9; i++) {
      if (te[i] !== me[i])
        return false;
    }
    return true;
  }
  fromArray(array, offset = 0) {
    for (let i = 0;i < 9; i++) {
      this.elements[i] = array[i + offset];
    }
    return this;
  }
  toArray(array = [], offset = 0) {
    const te = this.elements;
    array[offset] = te[0];
    array[offset + 1] = te[1];
    array[offset + 2] = te[2];
    array[offset + 3] = te[3];
    array[offset + 4] = te[4];
    array[offset + 5] = te[5];
    array[offset + 6] = te[6];
    array[offset + 7] = te[7];
    array[offset + 8] = te[8];
    return array;
  }
  clone() {
    return new this.constructor().fromArray(this.elements);
  }
}
var _m3 = /* @__PURE__ */ new Matrix3;
var LINEAR_REC709_TO_XYZ = /* @__PURE__ */ new Matrix3().set(0.4123908, 0.3575843, 0.1804808, 0.212639, 0.7151687, 0.0721923, 0.0193308, 0.1191948, 0.9505322);
var XYZ_TO_LINEAR_REC709 = /* @__PURE__ */ new Matrix3().set(3.2409699, -1.5373832, -0.4986108, -0.9692436, 1.8759675, 0.0415551, 0.0556301, -0.203977, 1.0569715);
function createColorManagement() {
  const ColorManagement = {
    enabled: true,
    workingColorSpace: LinearSRGBColorSpace,
    spaces: {},
    convert: function(color, sourceColorSpace, targetColorSpace) {
      if (this.enabled === false || sourceColorSpace === targetColorSpace || !sourceColorSpace || !targetColorSpace) {
        return color;
      }
      if (this.spaces[sourceColorSpace].transfer === SRGBTransfer) {
        color.r = SRGBToLinear(color.r);
        color.g = SRGBToLinear(color.g);
        color.b = SRGBToLinear(color.b);
      }
      if (this.spaces[sourceColorSpace].primaries !== this.spaces[targetColorSpace].primaries) {
        color.applyMatrix3(this.spaces[sourceColorSpace].toXYZ);
        color.applyMatrix3(this.spaces[targetColorSpace].fromXYZ);
      }
      if (this.spaces[targetColorSpace].transfer === SRGBTransfer) {
        color.r = LinearToSRGB(color.r);
        color.g = LinearToSRGB(color.g);
        color.b = LinearToSRGB(color.b);
      }
      return color;
    },
    workingToColorSpace: function(color, targetColorSpace) {
      return this.convert(color, this.workingColorSpace, targetColorSpace);
    },
    colorSpaceToWorking: function(color, sourceColorSpace) {
      return this.convert(color, sourceColorSpace, this.workingColorSpace);
    },
    getPrimaries: function(colorSpace) {
      return this.spaces[colorSpace].primaries;
    },
    getTransfer: function(colorSpace) {
      if (colorSpace === NoColorSpace)
        return LinearTransfer;
      return this.spaces[colorSpace].transfer;
    },
    getToneMappingMode: function(colorSpace) {
      return this.spaces[colorSpace].outputColorSpaceConfig.toneMappingMode || "standard";
    },
    getLuminanceCoefficients: function(target, colorSpace = this.workingColorSpace) {
      return target.fromArray(this.spaces[colorSpace].luminanceCoefficients);
    },
    define: function(colorSpaces) {
      Object.assign(this.spaces, colorSpaces);
    },
    _getMatrix: function(targetMatrix, sourceColorSpace, targetColorSpace) {
      return targetMatrix.copy(this.spaces[sourceColorSpace].toXYZ).multiply(this.spaces[targetColorSpace].fromXYZ);
    },
    _getDrawingBufferColorSpace: function(colorSpace) {
      return this.spaces[colorSpace].outputColorSpaceConfig.drawingBufferColorSpace;
    },
    _getUnpackColorSpace: function(colorSpace = this.workingColorSpace) {
      return this.spaces[colorSpace].workingColorSpaceConfig.unpackColorSpace;
    },
    fromWorkingColorSpace: function(color, targetColorSpace) {
      warnOnce("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace().");
      return ColorManagement.workingToColorSpace(color, targetColorSpace);
    },
    toWorkingColorSpace: function(color, sourceColorSpace) {
      warnOnce("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking().");
      return ColorManagement.colorSpaceToWorking(color, sourceColorSpace);
    }
  };
  const REC709_PRIMARIES = [0.64, 0.33, 0.3, 0.6, 0.15, 0.06];
  const REC709_LUMINANCE_COEFFICIENTS = [0.2126, 0.7152, 0.0722];
  const D65 = [0.3127, 0.329];
  ColorManagement.define({
    [LinearSRGBColorSpace]: {
      primaries: REC709_PRIMARIES,
      whitePoint: D65,
      transfer: LinearTransfer,
      toXYZ: LINEAR_REC709_TO_XYZ,
      fromXYZ: XYZ_TO_LINEAR_REC709,
      luminanceCoefficients: REC709_LUMINANCE_COEFFICIENTS,
      workingColorSpaceConfig: { unpackColorSpace: SRGBColorSpace },
      outputColorSpaceConfig: { drawingBufferColorSpace: SRGBColorSpace }
    },
    [SRGBColorSpace]: {
      primaries: REC709_PRIMARIES,
      whitePoint: D65,
      transfer: SRGBTransfer,
      toXYZ: LINEAR_REC709_TO_XYZ,
      fromXYZ: XYZ_TO_LINEAR_REC709,
      luminanceCoefficients: REC709_LUMINANCE_COEFFICIENTS,
      outputColorSpaceConfig: { drawingBufferColorSpace: SRGBColorSpace }
    }
  });
  return ColorManagement;
}
var ColorManagement = /* @__PURE__ */ createColorManagement();
function SRGBToLinear(c) {
  return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
}
function LinearToSRGB(c) {
  return c < 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 0.41666) - 0.055;
}
var _canvas;

class ImageUtils {
  static getDataURL(image, type = "image/png") {
    if (/^data:/i.test(image.src)) {
      return image.src;
    }
    if (typeof HTMLCanvasElement === "undefined") {
      return image.src;
    }
    let canvas;
    if (image instanceof HTMLCanvasElement) {
      canvas = image;
    } else {
      if (_canvas === undefined)
        _canvas = createElementNS("canvas");
      _canvas.width = image.width;
      _canvas.height = image.height;
      const context = _canvas.getContext("2d");
      if (image instanceof ImageData) {
        context.putImageData(image, 0, 0);
      } else {
        context.drawImage(image, 0, 0, image.width, image.height);
      }
      canvas = _canvas;
    }
    return canvas.toDataURL(type);
  }
  static sRGBToLinear(image) {
    if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement || typeof HTMLCanvasElement !== "undefined" && image instanceof HTMLCanvasElement || typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {
      const canvas = createElementNS("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, image.width, image.height);
      const imageData = context.getImageData(0, 0, image.width, image.height);
      const data = imageData.data;
      for (let i = 0;i < data.length; i++) {
        data[i] = SRGBToLinear(data[i] / 255) * 255;
      }
      context.putImageData(imageData, 0, 0);
      return canvas;
    } else if (image.data) {
      const data = image.data.slice(0);
      for (let i = 0;i < data.length; i++) {
        if (data instanceof Uint8Array || data instanceof Uint8ClampedArray) {
          data[i] = Math.floor(SRGBToLinear(data[i] / 255) * 255);
        } else {
          data[i] = SRGBToLinear(data[i]);
        }
      }
      return {
        data,
        width: image.width,
        height: image.height
      };
    } else {
      warn("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied.");
      return image;
    }
  }
}
var _sourceId = 0;

class Source {
  constructor(data = null) {
    this.isSource = true;
    Object.defineProperty(this, "id", { value: _sourceId++ });
    this.uuid = generateUUID();
    this.data = data;
    this.dataReady = true;
    this.version = 0;
  }
  getSize(target) {
    const data = this.data;
    if (typeof HTMLVideoElement !== "undefined" && data instanceof HTMLVideoElement) {
      target.set(data.videoWidth, data.videoHeight, 0);
    } else if (typeof VideoFrame !== "undefined" && data instanceof VideoFrame) {
      target.set(data.displayWidth, data.displayHeight, 0);
    } else if (data !== null) {
      target.set(data.width, data.height, data.depth || 0);
    } else {
      target.set(0, 0, 0);
    }
    return target;
  }
  set needsUpdate(value) {
    if (value === true)
      this.version++;
  }
  toJSON(meta) {
    const isRootObject = meta === undefined || typeof meta === "string";
    if (!isRootObject && meta.images[this.uuid] !== undefined) {
      return meta.images[this.uuid];
    }
    const output = {
      uuid: this.uuid,
      url: ""
    };
    const data = this.data;
    if (data !== null) {
      let url;
      if (Array.isArray(data)) {
        url = [];
        for (let i = 0, l = data.length;i < l; i++) {
          if (data[i].isDataTexture) {
            url.push(serializeImage(data[i].image));
          } else {
            url.push(serializeImage(data[i]));
          }
        }
      } else {
        url = serializeImage(data);
      }
      output.url = url;
    }
    if (!isRootObject) {
      meta.images[this.uuid] = output;
    }
    return output;
  }
}
function serializeImage(image) {
  if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement || typeof HTMLCanvasElement !== "undefined" && image instanceof HTMLCanvasElement || typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {
    return ImageUtils.getDataURL(image);
  } else {
    if (image.data) {
      return {
        data: Array.from(image.data),
        width: image.width,
        height: image.height,
        type: image.data.constructor.name
      };
    } else {
      warn("Texture: Unable to serialize Texture.");
      return {};
    }
  }
}
var _textureId = 0;
var _tempVec3 = /* @__PURE__ */ new Vector3;

class Texture extends EventDispatcher {
  constructor(image = Texture.DEFAULT_IMAGE, mapping = Texture.DEFAULT_MAPPING, wrapS = ClampToEdgeWrapping, wrapT = ClampToEdgeWrapping, magFilter = LinearFilter, minFilter = LinearMipmapLinearFilter, format = RGBAFormat, type = UnsignedByteType, anisotropy = Texture.DEFAULT_ANISOTROPY, colorSpace = NoColorSpace) {
    super();
    this.isTexture = true;
    Object.defineProperty(this, "id", { value: _textureId++ });
    this.uuid = generateUUID();
    this.name = "";
    this.source = new Source(image);
    this.mipmaps = [];
    this.mapping = mapping;
    this.channel = 0;
    this.wrapS = wrapS;
    this.wrapT = wrapT;
    this.magFilter = magFilter;
    this.minFilter = minFilter;
    this.anisotropy = anisotropy;
    this.format = format;
    this.internalFormat = null;
    this.type = type;
    this.offset = new Vector2(0, 0);
    this.repeat = new Vector2(1, 1);
    this.center = new Vector2(0, 0);
    this.rotation = 0;
    this.matrixAutoUpdate = true;
    this.matrix = new Matrix3;
    this.generateMipmaps = true;
    this.premultiplyAlpha = false;
    this.flipY = true;
    this.unpackAlignment = 4;
    this.colorSpace = colorSpace;
    this.userData = {};
    this.updateRanges = [];
    this.version = 0;
    this.onUpdate = null;
    this.renderTarget = null;
    this.isRenderTargetTexture = false;
    this.isArrayTexture = image && image.depth && image.depth > 1 ? true : false;
    this.pmremVersion = 0;
    this.normalized = false;
  }
  get width() {
    return this.source.getSize(_tempVec3).x;
  }
  get height() {
    return this.source.getSize(_tempVec3).y;
  }
  get depth() {
    return this.source.getSize(_tempVec3).z;
  }
  get image() {
    return this.source.data;
  }
  set image(value) {
    this.source.data = value;
  }
  updateMatrix() {
    this.matrix.setUvTransform(this.offset.x, this.offset.y, this.repeat.x, this.repeat.y, this.rotation, this.center.x, this.center.y);
  }
  addUpdateRange(start, count) {
    this.updateRanges.push({ start, count });
  }
  clearUpdateRanges() {
    this.updateRanges.length = 0;
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy(source) {
    this.name = source.name;
    this.source = source.source;
    this.mipmaps = source.mipmaps.slice(0);
    this.mapping = source.mapping;
    this.channel = source.channel;
    this.wrapS = source.wrapS;
    this.wrapT = source.wrapT;
    this.magFilter = source.magFilter;
    this.minFilter = source.minFilter;
    this.anisotropy = source.anisotropy;
    this.format = source.format;
    this.internalFormat = source.internalFormat;
    this.type = source.type;
    this.normalized = source.normalized;
    this.offset.copy(source.offset);
    this.repeat.copy(source.repeat);
    this.center.copy(source.center);
    this.rotation = source.rotation;
    this.matrixAutoUpdate = source.matrixAutoUpdate;
    this.matrix.copy(source.matrix);
    this.generateMipmaps = source.generateMipmaps;
    this.premultiplyAlpha = source.premultiplyAlpha;
    this.flipY = source.flipY;
    this.unpackAlignment = source.unpackAlignment;
    this.colorSpace = source.colorSpace;
    this.renderTarget = source.renderTarget;
    this.isRenderTargetTexture = source.isRenderTargetTexture;
    this.isArrayTexture = source.isArrayTexture;
    this.userData = JSON.parse(JSON.stringify(source.userData));
    this.needsUpdate = true;
    return this;
  }
  setValues(values) {
    for (const key in values) {
      const newValue = values[key];
      if (newValue === undefined) {
        warn(`Texture.setValues(): parameter '${key}' has value of undefined.`);
        continue;
      }
      const currentValue = this[key];
      if (currentValue === undefined) {
        warn(`Texture.setValues(): property '${key}' does not exist.`);
        continue;
      }
      if (currentValue && newValue && (currentValue.isVector2 && newValue.isVector2)) {
        currentValue.copy(newValue);
      } else if (currentValue && newValue && (currentValue.isVector3 && newValue.isVector3)) {
        currentValue.copy(newValue);
      } else if (currentValue && newValue && (currentValue.isMatrix3 && newValue.isMatrix3)) {
        currentValue.copy(newValue);
      } else {
        this[key] = newValue;
      }
    }
  }
  toJSON(meta) {
    const isRootObject = meta === undefined || typeof meta === "string";
    if (!isRootObject && meta.textures[this.uuid] !== undefined) {
      return meta.textures[this.uuid];
    }
    const output = {
      metadata: {
        version: 4.7,
        type: "Texture",
        generator: "Texture.toJSON"
      },
      uuid: this.uuid,
      name: this.name,
      image: this.source.toJSON(meta).uuid,
      mapping: this.mapping,
      channel: this.channel,
      repeat: [this.repeat.x, this.repeat.y],
      offset: [this.offset.x, this.offset.y],
      center: [this.center.x, this.center.y],
      rotation: this.rotation,
      wrap: [this.wrapS, this.wrapT],
      format: this.format,
      internalFormat: this.internalFormat,
      type: this.type,
      normalized: this.normalized,
      colorSpace: this.colorSpace,
      minFilter: this.minFilter,
      magFilter: this.magFilter,
      anisotropy: this.anisotropy,
      flipY: this.flipY,
      generateMipmaps: this.generateMipmaps,
      premultiplyAlpha: this.premultiplyAlpha,
      unpackAlignment: this.unpackAlignment
    };
    if (Object.keys(this.userData).length > 0)
      output.userData = this.userData;
    if (!isRootObject) {
      meta.textures[this.uuid] = output;
    }
    return output;
  }
  dispose() {
    this.dispatchEvent({ type: "dispose" });
  }
  transformUv(uv) {
    if (this.mapping !== UVMapping)
      return uv;
    uv.applyMatrix3(this.matrix);
    if (uv.x < 0 || uv.x > 1) {
      switch (this.wrapS) {
        case RepeatWrapping:
          uv.x = uv.x - Math.floor(uv.x);
          break;
        case ClampToEdgeWrapping:
          uv.x = uv.x < 0 ? 0 : 1;
          break;
        case MirroredRepeatWrapping:
          if (Math.abs(Math.floor(uv.x) % 2) === 1) {
            uv.x = Math.ceil(uv.x) - uv.x;
          } else {
            uv.x = uv.x - Math.floor(uv.x);
          }
          break;
      }
    }
    if (uv.y < 0 || uv.y > 1) {
      switch (this.wrapT) {
        case RepeatWrapping:
          uv.y = uv.y - Math.floor(uv.y);
          break;
        case ClampToEdgeWrapping:
          uv.y = uv.y < 0 ? 0 : 1;
          break;
        case MirroredRepeatWrapping:
          if (Math.abs(Math.floor(uv.y) % 2) === 1) {
            uv.y = Math.ceil(uv.y) - uv.y;
          } else {
            uv.y = uv.y - Math.floor(uv.y);
          }
          break;
      }
    }
    if (this.flipY) {
      uv.y = 1 - uv.y;
    }
    return uv;
  }
  set needsUpdate(value) {
    if (value === true) {
      this.version++;
      this.source.needsUpdate = true;
    }
  }
  set needsPMREMUpdate(value) {
    if (value === true) {
      this.pmremVersion++;
    }
  }
}
Texture.DEFAULT_IMAGE = null;
Texture.DEFAULT_MAPPING = UVMapping;
Texture.DEFAULT_ANISOTROPY = 1;

class Vector4 {
  static {
    Vector4.prototype.isVector4 = true;
  }
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }
  get width() {
    return this.z;
  }
  set width(value) {
    this.z = value;
  }
  get height() {
    return this.w;
  }
  set height(value) {
    this.w = value;
  }
  set(x, y, z, w) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }
  setScalar(scalar) {
    this.x = scalar;
    this.y = scalar;
    this.z = scalar;
    this.w = scalar;
    return this;
  }
  setX(x) {
    this.x = x;
    return this;
  }
  setY(y) {
    this.y = y;
    return this;
  }
  setZ(z) {
    this.z = z;
    return this;
  }
  setW(w) {
    this.w = w;
    return this;
  }
  setComponent(index, value) {
    switch (index) {
      case 0:
        this.x = value;
        break;
      case 1:
        this.y = value;
        break;
      case 2:
        this.z = value;
        break;
      case 3:
        this.w = value;
        break;
      default:
        throw new Error("THREE.Vector4: index is out of range: " + index);
    }
    return this;
  }
  getComponent(index) {
    switch (index) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      case 2:
        return this.z;
      case 3:
        return this.w;
      default:
        throw new Error("THREE.Vector4: index is out of range: " + index);
    }
  }
  clone() {
    return new this.constructor(this.x, this.y, this.z, this.w);
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    this.w = v.w !== undefined ? v.w : 1;
    return this;
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    this.w += v.w;
    return this;
  }
  addScalar(s) {
    this.x += s;
    this.y += s;
    this.z += s;
    this.w += s;
    return this;
  }
  addVectors(a, b) {
    this.x = a.x + b.x;
    this.y = a.y + b.y;
    this.z = a.z + b.z;
    this.w = a.w + b.w;
    return this;
  }
  addScaledVector(v, s) {
    this.x += v.x * s;
    this.y += v.y * s;
    this.z += v.z * s;
    this.w += v.w * s;
    return this;
  }
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    this.w -= v.w;
    return this;
  }
  subScalar(s) {
    this.x -= s;
    this.y -= s;
    this.z -= s;
    this.w -= s;
    return this;
  }
  subVectors(a, b) {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    this.z = a.z - b.z;
    this.w = a.w - b.w;
    return this;
  }
  multiply(v) {
    this.x *= v.x;
    this.y *= v.y;
    this.z *= v.z;
    this.w *= v.w;
    return this;
  }
  multiplyScalar(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    this.w *= scalar;
    return this;
  }
  applyMatrix4(m) {
    const x = this.x, y = this.y, z = this.z, w = this.w;
    const e = m.elements;
    this.x = e[0] * x + e[4] * y + e[8] * z + e[12] * w;
    this.y = e[1] * x + e[5] * y + e[9] * z + e[13] * w;
    this.z = e[2] * x + e[6] * y + e[10] * z + e[14] * w;
    this.w = e[3] * x + e[7] * y + e[11] * z + e[15] * w;
    return this;
  }
  divide(v) {
    this.x /= v.x;
    this.y /= v.y;
    this.z /= v.z;
    this.w /= v.w;
    return this;
  }
  divideScalar(scalar) {
    return this.multiplyScalar(1 / scalar);
  }
  setAxisAngleFromQuaternion(q) {
    this.w = 2 * Math.acos(q.w);
    const s = Math.sqrt(1 - q.w * q.w);
    if (s < 0.0001) {
      this.x = 1;
      this.y = 0;
      this.z = 0;
    } else {
      this.x = q.x / s;
      this.y = q.y / s;
      this.z = q.z / s;
    }
    return this;
  }
  setAxisAngleFromRotationMatrix(m) {
    let angle, x, y, z;
    const epsilon = 0.01, epsilon2 = 0.1, te = m.elements, m11 = te[0], m12 = te[4], m13 = te[8], m21 = te[1], m22 = te[5], m23 = te[9], m31 = te[2], m32 = te[6], m33 = te[10];
    if (Math.abs(m12 - m21) < epsilon && Math.abs(m13 - m31) < epsilon && Math.abs(m23 - m32) < epsilon) {
      if (Math.abs(m12 + m21) < epsilon2 && Math.abs(m13 + m31) < epsilon2 && Math.abs(m23 + m32) < epsilon2 && Math.abs(m11 + m22 + m33 - 3) < epsilon2) {
        this.set(1, 0, 0, 0);
        return this;
      }
      angle = Math.PI;
      const xx = (m11 + 1) / 2;
      const yy = (m22 + 1) / 2;
      const zz = (m33 + 1) / 2;
      const xy = (m12 + m21) / 4;
      const xz = (m13 + m31) / 4;
      const yz = (m23 + m32) / 4;
      if (xx > yy && xx > zz) {
        if (xx < epsilon) {
          x = 0;
          y = 0.707106781;
          z = 0.707106781;
        } else {
          x = Math.sqrt(xx);
          y = xy / x;
          z = xz / x;
        }
      } else if (yy > zz) {
        if (yy < epsilon) {
          x = 0.707106781;
          y = 0;
          z = 0.707106781;
        } else {
          y = Math.sqrt(yy);
          x = xy / y;
          z = yz / y;
        }
      } else {
        if (zz < epsilon) {
          x = 0.707106781;
          y = 0.707106781;
          z = 0;
        } else {
          z = Math.sqrt(zz);
          x = xz / z;
          y = yz / z;
        }
      }
      this.set(x, y, z, angle);
      return this;
    }
    let s = Math.sqrt((m32 - m23) * (m32 - m23) + (m13 - m31) * (m13 - m31) + (m21 - m12) * (m21 - m12));
    if (Math.abs(s) < 0.001)
      s = 1;
    this.x = (m32 - m23) / s;
    this.y = (m13 - m31) / s;
    this.z = (m21 - m12) / s;
    this.w = Math.acos((m11 + m22 + m33 - 1) / 2);
    return this;
  }
  setFromMatrixPosition(m) {
    const e = m.elements;
    this.x = e[12];
    this.y = e[13];
    this.z = e[14];
    this.w = e[15];
    return this;
  }
  min(v) {
    this.x = Math.min(this.x, v.x);
    this.y = Math.min(this.y, v.y);
    this.z = Math.min(this.z, v.z);
    this.w = Math.min(this.w, v.w);
    return this;
  }
  max(v) {
    this.x = Math.max(this.x, v.x);
    this.y = Math.max(this.y, v.y);
    this.z = Math.max(this.z, v.z);
    this.w = Math.max(this.w, v.w);
    return this;
  }
  clamp(min, max) {
    this.x = clamp(this.x, min.x, max.x);
    this.y = clamp(this.y, min.y, max.y);
    this.z = clamp(this.z, min.z, max.z);
    this.w = clamp(this.w, min.w, max.w);
    return this;
  }
  clampScalar(minVal, maxVal) {
    this.x = clamp(this.x, minVal, maxVal);
    this.y = clamp(this.y, minVal, maxVal);
    this.z = clamp(this.z, minVal, maxVal);
    this.w = clamp(this.w, minVal, maxVal);
    return this;
  }
  clampLength(min, max) {
    const length = this.length();
    return this.divideScalar(length || 1).multiplyScalar(clamp(length, min, max));
  }
  floor() {
    this.x = Math.floor(this.x);
    this.y = Math.floor(this.y);
    this.z = Math.floor(this.z);
    this.w = Math.floor(this.w);
    return this;
  }
  ceil() {
    this.x = Math.ceil(this.x);
    this.y = Math.ceil(this.y);
    this.z = Math.ceil(this.z);
    this.w = Math.ceil(this.w);
    return this;
  }
  round() {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    this.z = Math.round(this.z);
    this.w = Math.round(this.w);
    return this;
  }
  roundToZero() {
    this.x = Math.trunc(this.x);
    this.y = Math.trunc(this.y);
    this.z = Math.trunc(this.z);
    this.w = Math.trunc(this.w);
    return this;
  }
  negate() {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    this.w = -this.w;
    return this;
  }
  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z + this.w * v.w;
  }
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
  }
  manhattanLength() {
    return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z) + Math.abs(this.w);
  }
  normalize() {
    return this.divideScalar(this.length() || 1);
  }
  setLength(length) {
    return this.normalize().multiplyScalar(length);
  }
  lerp(v, alpha) {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    this.z += (v.z - this.z) * alpha;
    this.w += (v.w - this.w) * alpha;
    return this;
  }
  lerpVectors(v1, v2, alpha) {
    this.x = v1.x + (v2.x - v1.x) * alpha;
    this.y = v1.y + (v2.y - v1.y) * alpha;
    this.z = v1.z + (v2.z - v1.z) * alpha;
    this.w = v1.w + (v2.w - v1.w) * alpha;
    return this;
  }
  equals(v) {
    return v.x === this.x && v.y === this.y && v.z === this.z && v.w === this.w;
  }
  fromArray(array, offset = 0) {
    this.x = array[offset];
    this.y = array[offset + 1];
    this.z = array[offset + 2];
    this.w = array[offset + 3];
    return this;
  }
  toArray(array = [], offset = 0) {
    array[offset] = this.x;
    array[offset + 1] = this.y;
    array[offset + 2] = this.z;
    array[offset + 3] = this.w;
    return array;
  }
  fromBufferAttribute(attribute, index) {
    this.x = attribute.getX(index);
    this.y = attribute.getY(index);
    this.z = attribute.getZ(index);
    this.w = attribute.getW(index);
    return this;
  }
  random() {
    this.x = Math.random();
    this.y = Math.random();
    this.z = Math.random();
    this.w = Math.random();
    return this;
  }
  *[Symbol.iterator]() {
    yield this.x;
    yield this.y;
    yield this.z;
    yield this.w;
  }
}
class Matrix4 {
  static {
    Matrix4.prototype.isMatrix4 = true;
  }
  constructor(n11, n12, n13, n14, n21, n22, n23, n24, n31, n32, n33, n34, n41, n42, n43, n44) {
    this.elements = [
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1
    ];
    if (n11 !== undefined) {
      this.set(n11, n12, n13, n14, n21, n22, n23, n24, n31, n32, n33, n34, n41, n42, n43, n44);
    }
  }
  set(n11, n12, n13, n14, n21, n22, n23, n24, n31, n32, n33, n34, n41, n42, n43, n44) {
    const te = this.elements;
    te[0] = n11;
    te[4] = n12;
    te[8] = n13;
    te[12] = n14;
    te[1] = n21;
    te[5] = n22;
    te[9] = n23;
    te[13] = n24;
    te[2] = n31;
    te[6] = n32;
    te[10] = n33;
    te[14] = n34;
    te[3] = n41;
    te[7] = n42;
    te[11] = n43;
    te[15] = n44;
    return this;
  }
  identity() {
    this.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    return this;
  }
  clone() {
    return new Matrix4().fromArray(this.elements);
  }
  copy(m) {
    const te = this.elements;
    const me = m.elements;
    te[0] = me[0];
    te[1] = me[1];
    te[2] = me[2];
    te[3] = me[3];
    te[4] = me[4];
    te[5] = me[5];
    te[6] = me[6];
    te[7] = me[7];
    te[8] = me[8];
    te[9] = me[9];
    te[10] = me[10];
    te[11] = me[11];
    te[12] = me[12];
    te[13] = me[13];
    te[14] = me[14];
    te[15] = me[15];
    return this;
  }
  copyPosition(m) {
    const te = this.elements, me = m.elements;
    te[12] = me[12];
    te[13] = me[13];
    te[14] = me[14];
    return this;
  }
  setFromMatrix3(m) {
    const me = m.elements;
    this.set(me[0], me[3], me[6], 0, me[1], me[4], me[7], 0, me[2], me[5], me[8], 0, 0, 0, 0, 1);
    return this;
  }
  extractBasis(xAxis, yAxis, zAxis) {
    if (this.determinantAffine() === 0) {
      xAxis.set(1, 0, 0);
      yAxis.set(0, 1, 0);
      zAxis.set(0, 0, 1);
      return this;
    }
    xAxis.setFromMatrixColumn(this, 0);
    yAxis.setFromMatrixColumn(this, 1);
    zAxis.setFromMatrixColumn(this, 2);
    return this;
  }
  makeBasis(xAxis, yAxis, zAxis) {
    this.set(xAxis.x, yAxis.x, zAxis.x, 0, xAxis.y, yAxis.y, zAxis.y, 0, xAxis.z, yAxis.z, zAxis.z, 0, 0, 0, 0, 1);
    return this;
  }
  extractRotation(m) {
    if (m.determinantAffine() === 0) {
      return this.identity();
    }
    const te = this.elements;
    const me = m.elements;
    const scaleX = 1 / _v1$7.setFromMatrixColumn(m, 0).length();
    const scaleY = 1 / _v1$7.setFromMatrixColumn(m, 1).length();
    const scaleZ = 1 / _v1$7.setFromMatrixColumn(m, 2).length();
    te[0] = me[0] * scaleX;
    te[1] = me[1] * scaleX;
    te[2] = me[2] * scaleX;
    te[3] = 0;
    te[4] = me[4] * scaleY;
    te[5] = me[5] * scaleY;
    te[6] = me[6] * scaleY;
    te[7] = 0;
    te[8] = me[8] * scaleZ;
    te[9] = me[9] * scaleZ;
    te[10] = me[10] * scaleZ;
    te[11] = 0;
    te[12] = 0;
    te[13] = 0;
    te[14] = 0;
    te[15] = 1;
    return this;
  }
  makeRotationFromEuler(euler) {
    const te = this.elements;
    const { x, y, z } = euler;
    const a = Math.cos(x), b = Math.sin(x);
    const c = Math.cos(y), d = Math.sin(y);
    const e = Math.cos(z), f = Math.sin(z);
    if (euler.order === "XYZ") {
      const ae = a * e, af = a * f, be = b * e, bf = b * f;
      te[0] = c * e;
      te[4] = -c * f;
      te[8] = d;
      te[1] = af + be * d;
      te[5] = ae - bf * d;
      te[9] = -b * c;
      te[2] = bf - ae * d;
      te[6] = be + af * d;
      te[10] = a * c;
    } else if (euler.order === "YXZ") {
      const ce = c * e, cf = c * f, de = d * e, df = d * f;
      te[0] = ce + df * b;
      te[4] = de * b - cf;
      te[8] = a * d;
      te[1] = a * f;
      te[5] = a * e;
      te[9] = -b;
      te[2] = cf * b - de;
      te[6] = df + ce * b;
      te[10] = a * c;
    } else if (euler.order === "ZXY") {
      const ce = c * e, cf = c * f, de = d * e, df = d * f;
      te[0] = ce - df * b;
      te[4] = -a * f;
      te[8] = de + cf * b;
      te[1] = cf + de * b;
      te[5] = a * e;
      te[9] = df - ce * b;
      te[2] = -a * d;
      te[6] = b;
      te[10] = a * c;
    } else if (euler.order === "ZYX") {
      const ae = a * e, af = a * f, be = b * e, bf = b * f;
      te[0] = c * e;
      te[4] = be * d - af;
      te[8] = ae * d + bf;
      te[1] = c * f;
      te[5] = bf * d + ae;
      te[9] = af * d - be;
      te[2] = -d;
      te[6] = b * c;
      te[10] = a * c;
    } else if (euler.order === "YZX") {
      const ac = a * c, ad = a * d, bc = b * c, bd = b * d;
      te[0] = c * e;
      te[4] = bd - ac * f;
      te[8] = bc * f + ad;
      te[1] = f;
      te[5] = a * e;
      te[9] = -b * e;
      te[2] = -d * e;
      te[6] = ad * f + bc;
      te[10] = ac - bd * f;
    } else if (euler.order === "XZY") {
      const ac = a * c, ad = a * d, bc = b * c, bd = b * d;
      te[0] = c * e;
      te[4] = -f;
      te[8] = d * e;
      te[1] = ac * f + bd;
      te[5] = a * e;
      te[9] = ad * f - bc;
      te[2] = bc * f - ad;
      te[6] = b * e;
      te[10] = bd * f + ac;
    }
    te[3] = 0;
    te[7] = 0;
    te[11] = 0;
    te[12] = 0;
    te[13] = 0;
    te[14] = 0;
    te[15] = 1;
    return this;
  }
  makeRotationFromQuaternion(q) {
    return this.compose(_zero, q, _one);
  }
  lookAt(eye, target, up) {
    const te = this.elements;
    _z.subVectors(eye, target);
    if (_z.lengthSq() === 0) {
      _z.z = 1;
    }
    _z.normalize();
    _x.crossVectors(up, _z);
    if (_x.lengthSq() === 0) {
      if (Math.abs(up.z) === 1) {
        _z.x += 0.0001;
      } else {
        _z.z += 0.0001;
      }
      _z.normalize();
      _x.crossVectors(up, _z);
    }
    _x.normalize();
    _y.crossVectors(_z, _x);
    te[0] = _x.x;
    te[4] = _y.x;
    te[8] = _z.x;
    te[1] = _x.y;
    te[5] = _y.y;
    te[9] = _z.y;
    te[2] = _x.z;
    te[6] = _y.z;
    te[10] = _z.z;
    return this;
  }
  multiply(m) {
    return this.multiplyMatrices(this, m);
  }
  premultiply(m) {
    return this.multiplyMatrices(m, this);
  }
  multiplyMatrices(a, b) {
    const ae = a.elements;
    const be = b.elements;
    const te = this.elements;
    const a11 = ae[0], a12 = ae[4], a13 = ae[8], a14 = ae[12];
    const a21 = ae[1], a22 = ae[5], a23 = ae[9], a24 = ae[13];
    const a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14];
    const a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15];
    const b11 = be[0], b12 = be[4], b13 = be[8], b14 = be[12];
    const b21 = be[1], b22 = be[5], b23 = be[9], b24 = be[13];
    const b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14];
    const b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15];
    te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
    te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
    te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
    te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;
    te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
    te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
    te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
    te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;
    te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
    te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
    te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
    te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;
    te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
    te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
    te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
    te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
    return this;
  }
  multiplyScalar(s) {
    const te = this.elements;
    te[0] *= s;
    te[4] *= s;
    te[8] *= s;
    te[12] *= s;
    te[1] *= s;
    te[5] *= s;
    te[9] *= s;
    te[13] *= s;
    te[2] *= s;
    te[6] *= s;
    te[10] *= s;
    te[14] *= s;
    te[3] *= s;
    te[7] *= s;
    te[11] *= s;
    te[15] *= s;
    return this;
  }
  determinant() {
    const te = this.elements;
    const n11 = te[0], n12 = te[4], n13 = te[8], n14 = te[12];
    const n21 = te[1], n22 = te[5], n23 = te[9], n24 = te[13];
    const n31 = te[2], n32 = te[6], n33 = te[10], n34 = te[14];
    const n41 = te[3], n42 = te[7], n43 = te[11], n44 = te[15];
    const t11 = n23 * n34 - n24 * n33;
    const t12 = n22 * n34 - n24 * n32;
    const t13 = n22 * n33 - n23 * n32;
    const t21 = n21 * n34 - n24 * n31;
    const t22 = n21 * n33 - n23 * n31;
    const t23 = n21 * n32 - n22 * n31;
    return n11 * (n42 * t11 - n43 * t12 + n44 * t13) - n12 * (n41 * t11 - n43 * t21 + n44 * t22) + n13 * (n41 * t12 - n42 * t21 + n44 * t23) - n14 * (n41 * t13 - n42 * t22 + n43 * t23);
  }
  determinantAffine() {
    const te = this.elements;
    const n11 = te[0], n12 = te[4], n13 = te[8];
    const n21 = te[1], n22 = te[5], n23 = te[9];
    const n31 = te[2], n32 = te[6], n33 = te[10];
    return n11 * (n22 * n33 - n23 * n32) - n12 * (n21 * n33 - n23 * n31) + n13 * (n21 * n32 - n22 * n31);
  }
  transpose() {
    const te = this.elements;
    let tmp;
    tmp = te[1];
    te[1] = te[4];
    te[4] = tmp;
    tmp = te[2];
    te[2] = te[8];
    te[8] = tmp;
    tmp = te[6];
    te[6] = te[9];
    te[9] = tmp;
    tmp = te[3];
    te[3] = te[12];
    te[12] = tmp;
    tmp = te[7];
    te[7] = te[13];
    te[13] = tmp;
    tmp = te[11];
    te[11] = te[14];
    te[14] = tmp;
    return this;
  }
  setPosition(x, y, z) {
    const te = this.elements;
    if (x.isVector3) {
      te[12] = x.x;
      te[13] = x.y;
      te[14] = x.z;
    } else {
      te[12] = x;
      te[13] = y;
      te[14] = z;
    }
    return this;
  }
  invert() {
    const te = this.elements, n11 = te[0], n21 = te[1], n31 = te[2], n41 = te[3], n12 = te[4], n22 = te[5], n32 = te[6], n42 = te[7], n13 = te[8], n23 = te[9], n33 = te[10], n43 = te[11], n14 = te[12], n24 = te[13], n34 = te[14], n44 = te[15], t1 = n11 * n22 - n21 * n12, t2 = n11 * n32 - n31 * n12, t3 = n11 * n42 - n41 * n12, t4 = n21 * n32 - n31 * n22, t5 = n21 * n42 - n41 * n22, t6 = n31 * n42 - n41 * n32, t7 = n13 * n24 - n23 * n14, t8 = n13 * n34 - n33 * n14, t9 = n13 * n44 - n43 * n14, t10 = n23 * n34 - n33 * n24, t11 = n23 * n44 - n43 * n24, t12 = n33 * n44 - n43 * n34;
    const det = t1 * t12 - t2 * t11 + t3 * t10 + t4 * t9 - t5 * t8 + t6 * t7;
    if (det === 0)
      return this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    const detInv = 1 / det;
    te[0] = (n22 * t12 - n32 * t11 + n42 * t10) * detInv;
    te[1] = (n31 * t11 - n21 * t12 - n41 * t10) * detInv;
    te[2] = (n24 * t6 - n34 * t5 + n44 * t4) * detInv;
    te[3] = (n33 * t5 - n23 * t6 - n43 * t4) * detInv;
    te[4] = (n32 * t9 - n12 * t12 - n42 * t8) * detInv;
    te[5] = (n11 * t12 - n31 * t9 + n41 * t8) * detInv;
    te[6] = (n34 * t3 - n14 * t6 - n44 * t2) * detInv;
    te[7] = (n13 * t6 - n33 * t3 + n43 * t2) * detInv;
    te[8] = (n12 * t11 - n22 * t9 + n42 * t7) * detInv;
    te[9] = (n21 * t9 - n11 * t11 - n41 * t7) * detInv;
    te[10] = (n14 * t5 - n24 * t3 + n44 * t1) * detInv;
    te[11] = (n23 * t3 - n13 * t5 - n43 * t1) * detInv;
    te[12] = (n22 * t8 - n12 * t10 - n32 * t7) * detInv;
    te[13] = (n11 * t10 - n21 * t8 + n31 * t7) * detInv;
    te[14] = (n24 * t2 - n14 * t4 - n34 * t1) * detInv;
    te[15] = (n13 * t4 - n23 * t2 + n33 * t1) * detInv;
    return this;
  }
  scale(v) {
    const te = this.elements;
    const { x, y, z } = v;
    te[0] *= x;
    te[4] *= y;
    te[8] *= z;
    te[1] *= x;
    te[5] *= y;
    te[9] *= z;
    te[2] *= x;
    te[6] *= y;
    te[10] *= z;
    te[3] *= x;
    te[7] *= y;
    te[11] *= z;
    return this;
  }
  getMaxScaleOnAxis() {
    const te = this.elements;
    const scaleXSq = te[0] * te[0] + te[1] * te[1] + te[2] * te[2];
    const scaleYSq = te[4] * te[4] + te[5] * te[5] + te[6] * te[6];
    const scaleZSq = te[8] * te[8] + te[9] * te[9] + te[10] * te[10];
    return Math.sqrt(Math.max(scaleXSq, scaleYSq, scaleZSq));
  }
  makeTranslation(x, y, z) {
    if (x.isVector3) {
      this.set(1, 0, 0, x.x, 0, 1, 0, x.y, 0, 0, 1, x.z, 0, 0, 0, 1);
    } else {
      this.set(1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1);
    }
    return this;
  }
  makeRotationX(theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    this.set(1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1);
    return this;
  }
  makeRotationY(theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    this.set(c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1);
    return this;
  }
  makeRotationZ(theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    this.set(c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    return this;
  }
  makeRotationAxis(axis, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const t = 1 - c;
    const { x, y, z } = axis;
    const tx = t * x, ty = t * y;
    this.set(tx * x + c, tx * y - s * z, tx * z + s * y, 0, tx * y + s * z, ty * y + c, ty * z - s * x, 0, tx * z - s * y, ty * z + s * x, t * z * z + c, 0, 0, 0, 0, 1);
    return this;
  }
  makeScale(x, y, z) {
    this.set(x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1);
    return this;
  }
  makeShear(xy, xz, yx, yz, zx, zy) {
    this.set(1, yx, zx, 0, xy, 1, zy, 0, xz, yz, 1, 0, 0, 0, 0, 1);
    return this;
  }
  compose(position, quaternion, scale) {
    const te = this.elements;
    const { _x: x, _y: y, _z: z, _w: w } = quaternion;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const { x: sx, y: sy, z: sz } = scale;
    te[0] = (1 - (yy + zz)) * sx;
    te[1] = (xy + wz) * sx;
    te[2] = (xz - wy) * sx;
    te[3] = 0;
    te[4] = (xy - wz) * sy;
    te[5] = (1 - (xx + zz)) * sy;
    te[6] = (yz + wx) * sy;
    te[7] = 0;
    te[8] = (xz + wy) * sz;
    te[9] = (yz - wx) * sz;
    te[10] = (1 - (xx + yy)) * sz;
    te[11] = 0;
    te[12] = position.x;
    te[13] = position.y;
    te[14] = position.z;
    te[15] = 1;
    return this;
  }
  decompose(position, quaternion, scale) {
    const te = this.elements;
    position.x = te[12];
    position.y = te[13];
    position.z = te[14];
    const det = this.determinantAffine();
    if (det === 0) {
      scale.set(1, 1, 1);
      quaternion.identity();
      return this;
    }
    let sx = _v1$7.set(te[0], te[1], te[2]).length();
    const sy = _v1$7.set(te[4], te[5], te[6]).length();
    const sz = _v1$7.set(te[8], te[9], te[10]).length();
    if (det < 0)
      sx = -sx;
    _m1$2.copy(this);
    const invSX = 1 / sx;
    const invSY = 1 / sy;
    const invSZ = 1 / sz;
    _m1$2.elements[0] *= invSX;
    _m1$2.elements[1] *= invSX;
    _m1$2.elements[2] *= invSX;
    _m1$2.elements[4] *= invSY;
    _m1$2.elements[5] *= invSY;
    _m1$2.elements[6] *= invSY;
    _m1$2.elements[8] *= invSZ;
    _m1$2.elements[9] *= invSZ;
    _m1$2.elements[10] *= invSZ;
    quaternion.setFromRotationMatrix(_m1$2);
    scale.x = sx;
    scale.y = sy;
    scale.z = sz;
    return this;
  }
  makePerspective(left, right, top, bottom, near, far, coordinateSystem = WebGLCoordinateSystem, reversedDepth = false) {
    const te = this.elements;
    const x = 2 * near / (right - left);
    const y = 2 * near / (top - bottom);
    const a = (right + left) / (right - left);
    const b = (top + bottom) / (top - bottom);
    let c, d;
    if (reversedDepth) {
      c = near / (far - near);
      d = far * near / (far - near);
    } else {
      if (coordinateSystem === WebGLCoordinateSystem) {
        c = -(far + near) / (far - near);
        d = -2 * far * near / (far - near);
      } else if (coordinateSystem === WebGPUCoordinateSystem) {
        c = -far / (far - near);
        d = -far * near / (far - near);
      } else {
        throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: " + coordinateSystem);
      }
    }
    te[0] = x;
    te[4] = 0;
    te[8] = a;
    te[12] = 0;
    te[1] = 0;
    te[5] = y;
    te[9] = b;
    te[13] = 0;
    te[2] = 0;
    te[6] = 0;
    te[10] = c;
    te[14] = d;
    te[3] = 0;
    te[7] = 0;
    te[11] = -1;
    te[15] = 0;
    return this;
  }
  makeOrthographic(left, right, top, bottom, near, far, coordinateSystem = WebGLCoordinateSystem, reversedDepth = false) {
    const te = this.elements;
    const x = 2 / (right - left);
    const y = 2 / (top - bottom);
    const a = -(right + left) / (right - left);
    const b = -(top + bottom) / (top - bottom);
    let c, d;
    if (reversedDepth) {
      c = 1 / (far - near);
      d = far / (far - near);
    } else {
      if (coordinateSystem === WebGLCoordinateSystem) {
        c = -2 / (far - near);
        d = -(far + near) / (far - near);
      } else if (coordinateSystem === WebGPUCoordinateSystem) {
        c = -1 / (far - near);
        d = -near / (far - near);
      } else {
        throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: " + coordinateSystem);
      }
    }
    te[0] = x;
    te[4] = 0;
    te[8] = 0;
    te[12] = a;
    te[1] = 0;
    te[5] = y;
    te[9] = 0;
    te[13] = b;
    te[2] = 0;
    te[6] = 0;
    te[10] = c;
    te[14] = d;
    te[3] = 0;
    te[7] = 0;
    te[11] = 0;
    te[15] = 1;
    return this;
  }
  equals(matrix) {
    const te = this.elements;
    const me = matrix.elements;
    for (let i = 0;i < 16; i++) {
      if (te[i] !== me[i])
        return false;
    }
    return true;
  }
  fromArray(array, offset = 0) {
    for (let i = 0;i < 16; i++) {
      this.elements[i] = array[i + offset];
    }
    return this;
  }
  toArray(array = [], offset = 0) {
    const te = this.elements;
    array[offset] = te[0];
    array[offset + 1] = te[1];
    array[offset + 2] = te[2];
    array[offset + 3] = te[3];
    array[offset + 4] = te[4];
    array[offset + 5] = te[5];
    array[offset + 6] = te[6];
    array[offset + 7] = te[7];
    array[offset + 8] = te[8];
    array[offset + 9] = te[9];
    array[offset + 10] = te[10];
    array[offset + 11] = te[11];
    array[offset + 12] = te[12];
    array[offset + 13] = te[13];
    array[offset + 14] = te[14];
    array[offset + 15] = te[15];
    return array;
  }
}
var _v1$7 = /* @__PURE__ */ new Vector3;
var _m1$2 = /* @__PURE__ */ new Matrix4;
var _zero = /* @__PURE__ */ new Vector3(0, 0, 0);
var _one = /* @__PURE__ */ new Vector3(1, 1, 1);
var _x = /* @__PURE__ */ new Vector3;
var _y = /* @__PURE__ */ new Vector3;
var _z = /* @__PURE__ */ new Vector3;
var _matrix$2 = /* @__PURE__ */ new Matrix4;
var _quaternion$4 = /* @__PURE__ */ new Quaternion;

class Euler {
  constructor(x = 0, y = 0, z = 0, order = Euler.DEFAULT_ORDER) {
    this.isEuler = true;
    this._x = x;
    this._y = y;
    this._z = z;
    this._order = order;
  }
  get x() {
    return this._x;
  }
  set x(value) {
    this._x = value;
    this._onChangeCallback();
  }
  get y() {
    return this._y;
  }
  set y(value) {
    this._y = value;
    this._onChangeCallback();
  }
  get z() {
    return this._z;
  }
  set z(value) {
    this._z = value;
    this._onChangeCallback();
  }
  get order() {
    return this._order;
  }
  set order(value) {
    this._order = value;
    this._onChangeCallback();
  }
  set(x, y, z, order = this._order) {
    this._x = x;
    this._y = y;
    this._z = z;
    this._order = order;
    this._onChangeCallback();
    return this;
  }
  clone() {
    return new this.constructor(this._x, this._y, this._z, this._order);
  }
  copy(euler) {
    this._x = euler._x;
    this._y = euler._y;
    this._z = euler._z;
    this._order = euler._order;
    this._onChangeCallback();
    return this;
  }
  setFromRotationMatrix(m, order = this._order, update = true) {
    const te = m.elements;
    const m11 = te[0], m12 = te[4], m13 = te[8];
    const m21 = te[1], m22 = te[5], m23 = te[9];
    const m31 = te[2], m32 = te[6], m33 = te[10];
    switch (order) {
      case "XYZ":
        this._y = Math.asin(clamp(m13, -1, 1));
        if (Math.abs(m13) < 0.9999999) {
          this._x = Math.atan2(-m23, m33);
          this._z = Math.atan2(-m12, m11);
        } else {
          this._x = Math.atan2(m32, m22);
          this._z = 0;
        }
        break;
      case "YXZ":
        this._x = Math.asin(-clamp(m23, -1, 1));
        if (Math.abs(m23) < 0.9999999) {
          this._y = Math.atan2(m13, m33);
          this._z = Math.atan2(m21, m22);
        } else {
          this._y = Math.atan2(-m31, m11);
          this._z = 0;
        }
        break;
      case "ZXY":
        this._x = Math.asin(clamp(m32, -1, 1));
        if (Math.abs(m32) < 0.9999999) {
          this._y = Math.atan2(-m31, m33);
          this._z = Math.atan2(-m12, m22);
        } else {
          this._y = 0;
          this._z = Math.atan2(m21, m11);
        }
        break;
      case "ZYX":
        this._y = Math.asin(-clamp(m31, -1, 1));
        if (Math.abs(m31) < 0.9999999) {
          this._x = Math.atan2(m32, m33);
          this._z = Math.atan2(m21, m11);
        } else {
          this._x = 0;
          this._z = Math.atan2(-m12, m22);
        }
        break;
      case "YZX":
        this._z = Math.asin(clamp(m21, -1, 1));
        if (Math.abs(m21) < 0.9999999) {
          this._x = Math.atan2(-m23, m22);
          this._y = Math.atan2(-m31, m11);
        } else {
          this._x = 0;
          this._y = Math.atan2(m13, m33);
        }
        break;
      case "XZY":
        this._z = Math.asin(-clamp(m12, -1, 1));
        if (Math.abs(m12) < 0.9999999) {
          this._x = Math.atan2(m32, m22);
          this._y = Math.atan2(m13, m11);
        } else {
          this._x = Math.atan2(-m23, m33);
          this._y = 0;
        }
        break;
      default:
        warn("Euler: .setFromRotationMatrix() encountered an unknown order: " + order);
    }
    this._order = order;
    if (update === true)
      this._onChangeCallback();
    return this;
  }
  setFromQuaternion(q, order, update) {
    _matrix$2.makeRotationFromQuaternion(q);
    return this.setFromRotationMatrix(_matrix$2, order, update);
  }
  setFromVector3(v, order = this._order) {
    return this.set(v.x, v.y, v.z, order);
  }
  reorder(newOrder) {
    _quaternion$4.setFromEuler(this);
    return this.setFromQuaternion(_quaternion$4, newOrder);
  }
  equals(euler) {
    return euler._x === this._x && euler._y === this._y && euler._z === this._z && euler._order === this._order;
  }
  fromArray(array) {
    this._x = array[0];
    this._y = array[1];
    this._z = array[2];
    if (array[3] !== undefined)
      this._order = array[3];
    this._onChangeCallback();
    return this;
  }
  toArray(array = [], offset = 0) {
    array[offset] = this._x;
    array[offset + 1] = this._y;
    array[offset + 2] = this._z;
    array[offset + 3] = this._order;
    return array;
  }
  _onChange(callback) {
    this._onChangeCallback = callback;
    return this;
  }
  _onChangeCallback() {}
  *[Symbol.iterator]() {
    yield this._x;
    yield this._y;
    yield this._z;
    yield this._order;
  }
}
Euler.DEFAULT_ORDER = "XYZ";

class Layers {
  constructor() {
    this.mask = 1 | 0;
  }
  set(layer) {
    this.mask = (1 << layer | 0) >>> 0;
  }
  enable(layer) {
    this.mask |= 1 << layer | 0;
  }
  enableAll() {
    this.mask = 4294967295 | 0;
  }
  toggle(layer) {
    this.mask ^= 1 << layer | 0;
  }
  disable(layer) {
    this.mask &= ~(1 << layer | 0);
  }
  disableAll() {
    this.mask = 0;
  }
  test(layers) {
    return (this.mask & layers.mask) !== 0;
  }
  isEnabled(layer) {
    return (this.mask & (1 << layer | 0)) !== 0;
  }
}
var _object3DId = 0;
var _v1$6 = /* @__PURE__ */ new Vector3;
var _q1 = /* @__PURE__ */ new Quaternion;
var _m1$1 = /* @__PURE__ */ new Matrix4;
var _target = /* @__PURE__ */ new Vector3;
var _position$4 = /* @__PURE__ */ new Vector3;
var _scale$3 = /* @__PURE__ */ new Vector3;
var _quaternion$3 = /* @__PURE__ */ new Quaternion;
var _xAxis = /* @__PURE__ */ new Vector3(1, 0, 0);
var _yAxis = /* @__PURE__ */ new Vector3(0, 1, 0);
var _zAxis = /* @__PURE__ */ new Vector3(0, 0, 1);
var _addedEvent = { type: "added" };
var _removedEvent = { type: "removed" };
var _childaddedEvent = { type: "childadded", child: null };
var _childremovedEvent = { type: "childremoved", child: null };

class Object3D extends EventDispatcher {
  constructor() {
    super();
    this.isObject3D = true;
    Object.defineProperty(this, "id", { value: _object3DId++ });
    this.uuid = generateUUID();
    this.name = "";
    this.type = "Object3D";
    this.parent = null;
    this.children = [];
    this.up = Object3D.DEFAULT_UP.clone();
    const position = new Vector3;
    const rotation = new Euler;
    const quaternion = new Quaternion;
    const scale = new Vector3(1, 1, 1);
    function onRotationChange() {
      quaternion.setFromEuler(rotation, false);
    }
    function onQuaternionChange() {
      rotation.setFromQuaternion(quaternion, undefined, false);
    }
    rotation._onChange(onRotationChange);
    quaternion._onChange(onQuaternionChange);
    Object.defineProperties(this, {
      position: {
        configurable: true,
        enumerable: true,
        value: position
      },
      rotation: {
        configurable: true,
        enumerable: true,
        value: rotation
      },
      quaternion: {
        configurable: true,
        enumerable: true,
        value: quaternion
      },
      scale: {
        configurable: true,
        enumerable: true,
        value: scale
      },
      modelViewMatrix: {
        value: new Matrix4
      },
      normalMatrix: {
        value: new Matrix3
      }
    });
    this.matrix = new Matrix4;
    this.matrixWorld = new Matrix4;
    this.matrixAutoUpdate = Object3D.DEFAULT_MATRIX_AUTO_UPDATE;
    this.matrixWorldAutoUpdate = Object3D.DEFAULT_MATRIX_WORLD_AUTO_UPDATE;
    this.matrixWorldNeedsUpdate = false;
    this.layers = new Layers;
    this.visible = true;
    this.castShadow = false;
    this.receiveShadow = false;
    this.frustumCulled = true;
    this.renderOrder = 0;
    this.animations = [];
    this.customDepthMaterial = undefined;
    this.customDistanceMaterial = undefined;
    this.static = false;
    this.userData = {};
    this.pivot = null;
  }
  onBeforeShadow() {}
  onAfterShadow() {}
  onBeforeRender() {}
  onAfterRender() {}
  applyMatrix4(matrix) {
    if (this.matrixAutoUpdate)
      this.updateMatrix();
    this.matrix.premultiply(matrix);
    this.matrix.decompose(this.position, this.quaternion, this.scale);
  }
  applyQuaternion(q) {
    this.quaternion.premultiply(q);
    return this;
  }
  setRotationFromAxisAngle(axis, angle) {
    this.quaternion.setFromAxisAngle(axis, angle);
  }
  setRotationFromEuler(euler) {
    this.quaternion.setFromEuler(euler, true);
  }
  setRotationFromMatrix(m) {
    this.quaternion.setFromRotationMatrix(m);
  }
  setRotationFromQuaternion(q) {
    this.quaternion.copy(q);
  }
  rotateOnAxis(axis, angle) {
    _q1.setFromAxisAngle(axis, angle);
    this.quaternion.multiply(_q1);
    return this;
  }
  rotateOnWorldAxis(axis, angle) {
    _q1.setFromAxisAngle(axis, angle);
    this.quaternion.premultiply(_q1);
    return this;
  }
  rotateX(angle) {
    return this.rotateOnAxis(_xAxis, angle);
  }
  rotateY(angle) {
    return this.rotateOnAxis(_yAxis, angle);
  }
  rotateZ(angle) {
    return this.rotateOnAxis(_zAxis, angle);
  }
  translateOnAxis(axis, distance) {
    _v1$6.copy(axis).applyQuaternion(this.quaternion);
    this.position.add(_v1$6.multiplyScalar(distance));
    return this;
  }
  translateX(distance) {
    return this.translateOnAxis(_xAxis, distance);
  }
  translateY(distance) {
    return this.translateOnAxis(_yAxis, distance);
  }
  translateZ(distance) {
    return this.translateOnAxis(_zAxis, distance);
  }
  localToWorld(vector) {
    this.updateWorldMatrix(true, false);
    return vector.applyMatrix4(this.matrixWorld);
  }
  worldToLocal(vector) {
    this.updateWorldMatrix(true, false);
    return vector.applyMatrix4(_m1$1.copy(this.matrixWorld).invert());
  }
  lookAt(x, y, z) {
    if (x.isVector3) {
      _target.copy(x);
    } else {
      _target.set(x, y, z);
    }
    const parent = this.parent;
    this.updateWorldMatrix(true, false);
    _position$4.setFromMatrixPosition(this.matrixWorld);
    if (this.isCamera || this.isLight) {
      _m1$1.lookAt(_position$4, _target, this.up);
    } else {
      _m1$1.lookAt(_target, _position$4, this.up);
    }
    this.quaternion.setFromRotationMatrix(_m1$1);
    if (parent) {
      _m1$1.extractRotation(parent.matrixWorld);
      _q1.setFromRotationMatrix(_m1$1);
      this.quaternion.premultiply(_q1.invert());
    }
  }
  add(object) {
    if (arguments.length > 1) {
      for (let i = 0;i < arguments.length; i++) {
        this.add(arguments[i]);
      }
      return this;
    }
    if (object === this) {
      error("Object3D.add: object can't be added as a child of itself.", object);
      return this;
    }
    if (object && object.isObject3D) {
      object.removeFromParent();
      object.parent = this;
      this.children.push(object);
      object.dispatchEvent(_addedEvent);
      _childaddedEvent.child = object;
      this.dispatchEvent(_childaddedEvent);
      _childaddedEvent.child = null;
    } else {
      error("Object3D.add: object not an instance of THREE.Object3D.", object);
    }
    return this;
  }
  remove(object) {
    if (arguments.length > 1) {
      for (let i = 0;i < arguments.length; i++) {
        this.remove(arguments[i]);
      }
      return this;
    }
    const index = this.children.indexOf(object);
    if (index !== -1) {
      object.parent = null;
      this.children.splice(index, 1);
      object.dispatchEvent(_removedEvent);
      _childremovedEvent.child = object;
      this.dispatchEvent(_childremovedEvent);
      _childremovedEvent.child = null;
    }
    return this;
  }
  removeFromParent() {
    const parent = this.parent;
    if (parent !== null) {
      parent.remove(this);
    }
    return this;
  }
  clear() {
    return this.remove(...this.children);
  }
  attach(object) {
    this.updateWorldMatrix(true, false);
    _m1$1.copy(this.matrixWorld).invert();
    if (object.parent !== null) {
      object.parent.updateWorldMatrix(true, false);
      _m1$1.multiply(object.parent.matrixWorld);
    }
    object.applyMatrix4(_m1$1);
    object.removeFromParent();
    object.parent = this;
    this.children.push(object);
    object.updateWorldMatrix(false, true);
    object.dispatchEvent(_addedEvent);
    _childaddedEvent.child = object;
    this.dispatchEvent(_childaddedEvent);
    _childaddedEvent.child = null;
    return this;
  }
  getObjectById(id) {
    return this.getObjectByProperty("id", id);
  }
  getObjectByName(name) {
    return this.getObjectByProperty("name", name);
  }
  getObjectByProperty(name, value) {
    if (this[name] === value)
      return this;
    for (let i = 0, l = this.children.length;i < l; i++) {
      const child = this.children[i];
      const object = child.getObjectByProperty(name, value);
      if (object !== undefined) {
        return object;
      }
    }
    return;
  }
  getObjectsByProperty(name, value, result = []) {
    if (this[name] === value)
      result.push(this);
    const children = this.children;
    for (let i = 0, l = children.length;i < l; i++) {
      children[i].getObjectsByProperty(name, value, result);
    }
    return result;
  }
  getWorldPosition(target) {
    this.updateWorldMatrix(true, false);
    return target.setFromMatrixPosition(this.matrixWorld);
  }
  getWorldQuaternion(target) {
    this.updateWorldMatrix(true, false);
    this.matrixWorld.decompose(_position$4, target, _scale$3);
    return target;
  }
  getWorldScale(target) {
    this.updateWorldMatrix(true, false);
    this.matrixWorld.decompose(_position$4, _quaternion$3, target);
    return target;
  }
  getWorldDirection(target) {
    this.updateWorldMatrix(true, false);
    const e = this.matrixWorld.elements;
    return target.set(e[8], e[9], e[10]).normalize();
  }
  raycast() {}
  traverse(callback) {
    callback(this);
    const children = this.children;
    for (let i = 0, l = children.length;i < l; i++) {
      children[i].traverse(callback);
    }
  }
  traverseVisible(callback) {
    if (this.visible === false)
      return;
    callback(this);
    const children = this.children;
    for (let i = 0, l = children.length;i < l; i++) {
      children[i].traverseVisible(callback);
    }
  }
  traverseAncestors(callback) {
    const parent = this.parent;
    if (parent !== null) {
      callback(parent);
      parent.traverseAncestors(callback);
    }
  }
  updateMatrix() {
    this.matrix.compose(this.position, this.quaternion, this.scale);
    const pivot = this.pivot;
    if (pivot !== null) {
      const { x: px, y: py, z: pz } = pivot;
      const te = this.matrix.elements;
      te[12] += px - te[0] * px - te[4] * py - te[8] * pz;
      te[13] += py - te[1] * px - te[5] * py - te[9] * pz;
      te[14] += pz - te[2] * px - te[6] * py - te[10] * pz;
    }
    this.matrixWorldNeedsUpdate = true;
  }
  updateMatrixWorld(force) {
    if (this.matrixAutoUpdate)
      this.updateMatrix();
    if (this.matrixWorldNeedsUpdate || force) {
      if (this.matrixWorldAutoUpdate === true) {
        if (this.parent === null) {
          this.matrixWorld.copy(this.matrix);
        } else {
          this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
        }
      }
      this.matrixWorldNeedsUpdate = false;
      force = true;
    }
    const children = this.children;
    for (let i = 0, l = children.length;i < l; i++) {
      const child = children[i];
      child.updateMatrixWorld(force);
    }
  }
  updateWorldMatrix(updateParents, updateChildren, force = false) {
    const parent = this.parent;
    if (updateParents === true && parent !== null) {
      parent.updateWorldMatrix(true, false);
    }
    if (this.matrixAutoUpdate)
      this.updateMatrix();
    if (this.matrixWorldNeedsUpdate || force) {
      if (this.matrixWorldAutoUpdate === true) {
        if (this.parent === null) {
          this.matrixWorld.copy(this.matrix);
        } else {
          this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
        }
      }
      this.matrixWorldNeedsUpdate = false;
      force = true;
    }
    if (updateChildren === true) {
      const children = this.children;
      for (let i = 0, l = children.length;i < l; i++) {
        const child = children[i];
        child.updateWorldMatrix(false, true, force);
      }
    }
  }
  toJSON(meta) {
    const isRootObject = meta === undefined || typeof meta === "string";
    const output = {};
    if (isRootObject) {
      meta = {
        geometries: {},
        materials: {},
        textures: {},
        images: {},
        shapes: {},
        skeletons: {},
        animations: {},
        nodes: {}
      };
      output.metadata = {
        version: 4.7,
        type: "Object",
        generator: "Object3D.toJSON"
      };
    }
    const object = {};
    object.uuid = this.uuid;
    object.type = this.type;
    if (this.name !== "")
      object.name = this.name;
    if (this.castShadow === true)
      object.castShadow = true;
    if (this.receiveShadow === true)
      object.receiveShadow = true;
    if (this.visible === false)
      object.visible = false;
    if (this.frustumCulled === false)
      object.frustumCulled = false;
    if (this.renderOrder !== 0)
      object.renderOrder = this.renderOrder;
    if (this.static !== false)
      object.static = this.static;
    if (Object.keys(this.userData).length > 0)
      object.userData = this.userData;
    object.layers = this.layers.mask;
    object.matrix = this.matrix.toArray();
    object.up = this.up.toArray();
    if (this.pivot !== null)
      object.pivot = this.pivot.toArray();
    if (this.matrixAutoUpdate === false)
      object.matrixAutoUpdate = false;
    if (this.morphTargetDictionary !== undefined)
      object.morphTargetDictionary = Object.assign({}, this.morphTargetDictionary);
    if (this.morphTargetInfluences !== undefined)
      object.morphTargetInfluences = this.morphTargetInfluences.slice();
    if (this.isInstancedMesh) {
      object.type = "InstancedMesh";
      object.count = this.count;
      object.instanceMatrix = this.instanceMatrix.toJSON();
      if (this.instanceColor !== null)
        object.instanceColor = this.instanceColor.toJSON();
    }
    if (this.isBatchedMesh) {
      object.type = "BatchedMesh";
      object.perObjectFrustumCulled = this.perObjectFrustumCulled;
      object.sortObjects = this.sortObjects;
      object.drawRanges = this._drawRanges;
      object.reservedRanges = this._reservedRanges;
      object.geometryInfo = this._geometryInfo.map((info) => ({
        ...info,
        boundingBox: info.boundingBox ? info.boundingBox.toJSON() : undefined,
        boundingSphere: info.boundingSphere ? info.boundingSphere.toJSON() : undefined
      }));
      object.instanceInfo = this._instanceInfo.map((info) => ({ ...info }));
      object.availableInstanceIds = this._availableInstanceIds.slice();
      object.availableGeometryIds = this._availableGeometryIds.slice();
      object.nextIndexStart = this._nextIndexStart;
      object.nextVertexStart = this._nextVertexStart;
      object.geometryCount = this._geometryCount;
      object.maxInstanceCount = this._maxInstanceCount;
      object.maxVertexCount = this._maxVertexCount;
      object.maxIndexCount = this._maxIndexCount;
      object.geometryInitialized = this._geometryInitialized;
      object.matricesTexture = this._matricesTexture.toJSON(meta);
      object.indirectTexture = this._indirectTexture.toJSON(meta);
      if (this._colorsTexture !== null) {
        object.colorsTexture = this._colorsTexture.toJSON(meta);
      }
      if (this.boundingSphere !== null) {
        object.boundingSphere = this.boundingSphere.toJSON();
      }
      if (this.boundingBox !== null) {
        object.boundingBox = this.boundingBox.toJSON();
      }
    }
    function serialize(library, element) {
      if (library[element.uuid] === undefined) {
        library[element.uuid] = element.toJSON(meta);
      }
      return element.uuid;
    }
    if (this.isScene) {
      if (this.background) {
        if (this.background.isColor) {
          object.background = this.background.toJSON();
        } else if (this.background.isTexture) {
          object.background = this.background.toJSON(meta).uuid;
        }
      }
      if (this.environment && this.environment.isTexture && this.environment.isRenderTargetTexture !== true) {
        object.environment = this.environment.toJSON(meta).uuid;
      }
    } else if (this.isMesh || this.isLine || this.isPoints) {
      object.geometry = serialize(meta.geometries, this.geometry);
      const parameters = this.geometry.parameters;
      if (parameters !== undefined && parameters.shapes !== undefined) {
        const shapes = parameters.shapes;
        if (Array.isArray(shapes)) {
          for (let i = 0, l = shapes.length;i < l; i++) {
            const shape = shapes[i];
            serialize(meta.shapes, shape);
          }
        } else {
          serialize(meta.shapes, shapes);
        }
      }
    }
    if (this.isSkinnedMesh) {
      object.bindMode = this.bindMode;
      object.bindMatrix = this.bindMatrix.toArray();
      if (this.skeleton !== undefined) {
        serialize(meta.skeletons, this.skeleton);
        object.skeleton = this.skeleton.uuid;
      }
    }
    if (this.material !== undefined) {
      if (Array.isArray(this.material)) {
        const uuids = [];
        for (let i = 0, l = this.material.length;i < l; i++) {
          uuids.push(serialize(meta.materials, this.material[i]));
        }
        object.material = uuids;
      } else {
        object.material = serialize(meta.materials, this.material);
      }
    }
    if (this.children.length > 0) {
      object.children = [];
      for (let i = 0;i < this.children.length; i++) {
        object.children.push(this.children[i].toJSON(meta).object);
      }
    }
    if (this.animations.length > 0) {
      object.animations = [];
      for (let i = 0;i < this.animations.length; i++) {
        const animation = this.animations[i];
        object.animations.push(serialize(meta.animations, animation));
      }
    }
    if (isRootObject) {
      const geometries = extractFromCache(meta.geometries);
      const materials = extractFromCache(meta.materials);
      const textures = extractFromCache(meta.textures);
      const images = extractFromCache(meta.images);
      const shapes = extractFromCache(meta.shapes);
      const skeletons = extractFromCache(meta.skeletons);
      const animations = extractFromCache(meta.animations);
      const nodes = extractFromCache(meta.nodes);
      if (geometries.length > 0)
        output.geometries = geometries;
      if (materials.length > 0)
        output.materials = materials;
      if (textures.length > 0)
        output.textures = textures;
      if (images.length > 0)
        output.images = images;
      if (shapes.length > 0)
        output.shapes = shapes;
      if (skeletons.length > 0)
        output.skeletons = skeletons;
      if (animations.length > 0)
        output.animations = animations;
      if (nodes.length > 0)
        output.nodes = nodes;
    }
    output.object = object;
    return output;
    function extractFromCache(cache) {
      const values = [];
      for (const key in cache) {
        const data = cache[key];
        delete data.metadata;
        values.push(data);
      }
      return values;
    }
  }
  clone(recursive) {
    return new this.constructor().copy(this, recursive);
  }
  copy(source, recursive = true) {
    this.name = source.name;
    this.up.copy(source.up);
    this.position.copy(source.position);
    this.rotation.order = source.rotation.order;
    this.quaternion.copy(source.quaternion);
    this.scale.copy(source.scale);
    this.pivot = source.pivot !== null ? source.pivot.clone() : null;
    this.matrix.copy(source.matrix);
    this.matrixWorld.copy(source.matrixWorld);
    this.matrixAutoUpdate = source.matrixAutoUpdate;
    this.matrixWorldAutoUpdate = source.matrixWorldAutoUpdate;
    this.matrixWorldNeedsUpdate = source.matrixWorldNeedsUpdate;
    this.layers.mask = source.layers.mask;
    this.visible = source.visible;
    this.castShadow = source.castShadow;
    this.receiveShadow = source.receiveShadow;
    this.frustumCulled = source.frustumCulled;
    this.renderOrder = source.renderOrder;
    this.static = source.static;
    this.animations = source.animations.slice();
    this.userData = JSON.parse(JSON.stringify(source.userData));
    if (recursive === true) {
      for (let i = 0;i < source.children.length; i++) {
        const child = source.children[i];
        this.add(child.clone());
      }
    }
    return this;
  }
}
Object3D.DEFAULT_UP = /* @__PURE__ */ new Vector3(0, 1, 0);
Object3D.DEFAULT_MATRIX_AUTO_UPDATE = true;
Object3D.DEFAULT_MATRIX_WORLD_AUTO_UPDATE = true;
var _colorKeywords = {
  aliceblue: 15792383,
  antiquewhite: 16444375,
  aqua: 65535,
  aquamarine: 8388564,
  azure: 15794175,
  beige: 16119260,
  bisque: 16770244,
  black: 0,
  blanchedalmond: 16772045,
  blue: 255,
  blueviolet: 9055202,
  brown: 10824234,
  burlywood: 14596231,
  cadetblue: 6266528,
  chartreuse: 8388352,
  chocolate: 13789470,
  coral: 16744272,
  cornflowerblue: 6591981,
  cornsilk: 16775388,
  crimson: 14423100,
  cyan: 65535,
  darkblue: 139,
  darkcyan: 35723,
  darkgoldenrod: 12092939,
  darkgray: 11119017,
  darkgreen: 25600,
  darkgrey: 11119017,
  darkkhaki: 12433259,
  darkmagenta: 9109643,
  darkolivegreen: 5597999,
  darkorange: 16747520,
  darkorchid: 10040012,
  darkred: 9109504,
  darksalmon: 15308410,
  darkseagreen: 9419919,
  darkslateblue: 4734347,
  darkslategray: 3100495,
  darkslategrey: 3100495,
  darkturquoise: 52945,
  darkviolet: 9699539,
  deeppink: 16716947,
  deepskyblue: 49151,
  dimgray: 6908265,
  dimgrey: 6908265,
  dodgerblue: 2003199,
  firebrick: 11674146,
  floralwhite: 16775920,
  forestgreen: 2263842,
  fuchsia: 16711935,
  gainsboro: 14474460,
  ghostwhite: 16316671,
  gold: 16766720,
  goldenrod: 14329120,
  gray: 8421504,
  green: 32768,
  greenyellow: 11403055,
  grey: 8421504,
  honeydew: 15794160,
  hotpink: 16738740,
  indianred: 13458524,
  indigo: 4915330,
  ivory: 16777200,
  khaki: 15787660,
  lavender: 15132410,
  lavenderblush: 16773365,
  lawngreen: 8190976,
  lemonchiffon: 16775885,
  lightblue: 11393254,
  lightcoral: 15761536,
  lightcyan: 14745599,
  lightgoldenrodyellow: 16448210,
  lightgray: 13882323,
  lightgreen: 9498256,
  lightgrey: 13882323,
  lightpink: 16758465,
  lightsalmon: 16752762,
  lightseagreen: 2142890,
  lightskyblue: 8900346,
  lightslategray: 7833753,
  lightslategrey: 7833753,
  lightsteelblue: 11584734,
  lightyellow: 16777184,
  lime: 65280,
  limegreen: 3329330,
  linen: 16445670,
  magenta: 16711935,
  maroon: 8388608,
  mediumaquamarine: 6737322,
  mediumblue: 205,
  mediumorchid: 12211667,
  mediumpurple: 9662683,
  mediumseagreen: 3978097,
  mediumslateblue: 8087790,
  mediumspringgreen: 64154,
  mediumturquoise: 4772300,
  mediumvioletred: 13047173,
  midnightblue: 1644912,
  mintcream: 16121850,
  mistyrose: 16770273,
  moccasin: 16770229,
  navajowhite: 16768685,
  navy: 128,
  oldlace: 16643558,
  olive: 8421376,
  olivedrab: 7048739,
  orange: 16753920,
  orangered: 16729344,
  orchid: 14315734,
  palegoldenrod: 15657130,
  palegreen: 10025880,
  paleturquoise: 11529966,
  palevioletred: 14381203,
  papayawhip: 16773077,
  peachpuff: 16767673,
  peru: 13468991,
  pink: 16761035,
  plum: 14524637,
  powderblue: 11591910,
  purple: 8388736,
  rebeccapurple: 6697881,
  red: 16711680,
  rosybrown: 12357519,
  royalblue: 4286945,
  saddlebrown: 9127187,
  salmon: 16416882,
  sandybrown: 16032864,
  seagreen: 3050327,
  seashell: 16774638,
  sienna: 10506797,
  silver: 12632256,
  skyblue: 8900331,
  slateblue: 6970061,
  slategray: 7372944,
  slategrey: 7372944,
  snow: 16775930,
  springgreen: 65407,
  steelblue: 4620980,
  tan: 13808780,
  teal: 32896,
  thistle: 14204888,
  tomato: 16737095,
  turquoise: 4251856,
  violet: 15631086,
  wheat: 16113331,
  white: 16777215,
  whitesmoke: 16119285,
  yellow: 16776960,
  yellowgreen: 10145074
};
var _hslA = { h: 0, s: 0, l: 0 };
var _hslB = { h: 0, s: 0, l: 0 };
function hue2rgb(p, q, t) {
  if (t < 0)
    t += 1;
  if (t > 1)
    t -= 1;
  if (t < 1 / 6)
    return p + (q - p) * 6 * t;
  if (t < 1 / 2)
    return q;
  if (t < 2 / 3)
    return p + (q - p) * 6 * (2 / 3 - t);
  return p;
}

class Color {
  constructor(r, g, b) {
    this.isColor = true;
    this.r = 1;
    this.g = 1;
    this.b = 1;
    return this.set(r, g, b);
  }
  set(r, g, b) {
    if (g === undefined && b === undefined) {
      const value = r;
      if (value && value.isColor) {
        this.copy(value);
      } else if (typeof value === "number") {
        this.setHex(value);
      } else if (typeof value === "string") {
        this.setStyle(value);
      }
    } else {
      this.setRGB(r, g, b);
    }
    return this;
  }
  setScalar(scalar) {
    this.r = scalar;
    this.g = scalar;
    this.b = scalar;
    return this;
  }
  setHex(hex, colorSpace = SRGBColorSpace) {
    hex = Math.floor(hex);
    this.r = (hex >> 16 & 255) / 255;
    this.g = (hex >> 8 & 255) / 255;
    this.b = (hex & 255) / 255;
    ColorManagement.colorSpaceToWorking(this, colorSpace);
    return this;
  }
  setRGB(r, g, b, colorSpace = ColorManagement.workingColorSpace) {
    this.r = r;
    this.g = g;
    this.b = b;
    ColorManagement.colorSpaceToWorking(this, colorSpace);
    return this;
  }
  setHSL(h, s, l, colorSpace = ColorManagement.workingColorSpace) {
    h = euclideanModulo(h, 1);
    s = clamp(s, 0, 1);
    l = clamp(l, 0, 1);
    if (s === 0) {
      this.r = this.g = this.b = l;
    } else {
      const p = l <= 0.5 ? l * (1 + s) : l + s - l * s;
      const q = 2 * l - p;
      this.r = hue2rgb(q, p, h + 1 / 3);
      this.g = hue2rgb(q, p, h);
      this.b = hue2rgb(q, p, h - 1 / 3);
    }
    ColorManagement.colorSpaceToWorking(this, colorSpace);
    return this;
  }
  setStyle(style, colorSpace = SRGBColorSpace) {
    function handleAlpha(string) {
      if (string === undefined)
        return;
      if (parseFloat(string) < 1) {
        warn("Color: Alpha component of " + style + " will be ignored.");
      }
    }
    let m;
    if (m = /^(\w+)\(([^\)]*)\)/.exec(style)) {
      let color;
      const name = m[1];
      const components = m[2];
      switch (name) {
        case "rgb":
        case "rgba":
          if (color = /^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(components)) {
            handleAlpha(color[4]);
            return this.setRGB(Math.min(255, parseInt(color[1], 10)) / 255, Math.min(255, parseInt(color[2], 10)) / 255, Math.min(255, parseInt(color[3], 10)) / 255, colorSpace);
          }
          if (color = /^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(components)) {
            handleAlpha(color[4]);
            return this.setRGB(Math.min(100, parseInt(color[1], 10)) / 100, Math.min(100, parseInt(color[2], 10)) / 100, Math.min(100, parseInt(color[3], 10)) / 100, colorSpace);
          }
          break;
        case "hsl":
        case "hsla":
          if (color = /^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(components)) {
            handleAlpha(color[4]);
            return this.setHSL(parseFloat(color[1]) / 360, parseFloat(color[2]) / 100, parseFloat(color[3]) / 100, colorSpace);
          }
          break;
        default:
          warn("Color: Unknown color model " + style);
      }
    } else if (m = /^\#([A-Fa-f\d]+)$/.exec(style)) {
      const hex = m[1];
      const size = hex.length;
      if (size === 3) {
        return this.setRGB(parseInt(hex.charAt(0), 16) / 15, parseInt(hex.charAt(1), 16) / 15, parseInt(hex.charAt(2), 16) / 15, colorSpace);
      } else if (size === 6) {
        return this.setHex(parseInt(hex, 16), colorSpace);
      } else {
        warn("Color: Invalid hex color " + style);
      }
    } else if (style && style.length > 0) {
      return this.setColorName(style, colorSpace);
    }
    return this;
  }
  setColorName(style, colorSpace = SRGBColorSpace) {
    const hex = _colorKeywords[style.toLowerCase()];
    if (hex !== undefined) {
      this.setHex(hex, colorSpace);
    } else {
      warn("Color: Unknown color " + style);
    }
    return this;
  }
  clone() {
    return new this.constructor(this.r, this.g, this.b);
  }
  copy(color) {
    this.r = color.r;
    this.g = color.g;
    this.b = color.b;
    return this;
  }
  copySRGBToLinear(color) {
    this.r = SRGBToLinear(color.r);
    this.g = SRGBToLinear(color.g);
    this.b = SRGBToLinear(color.b);
    return this;
  }
  copyLinearToSRGB(color) {
    this.r = LinearToSRGB(color.r);
    this.g = LinearToSRGB(color.g);
    this.b = LinearToSRGB(color.b);
    return this;
  }
  convertSRGBToLinear() {
    this.copySRGBToLinear(this);
    return this;
  }
  convertLinearToSRGB() {
    this.copyLinearToSRGB(this);
    return this;
  }
  getHex(colorSpace = SRGBColorSpace) {
    ColorManagement.workingToColorSpace(_color.copy(this), colorSpace);
    return Math.round(clamp(_color.r * 255, 0, 255)) * 65536 + Math.round(clamp(_color.g * 255, 0, 255)) * 256 + Math.round(clamp(_color.b * 255, 0, 255));
  }
  getHexString(colorSpace = SRGBColorSpace) {
    return ("000000" + this.getHex(colorSpace).toString(16)).slice(-6);
  }
  getHSL(target, colorSpace = ColorManagement.workingColorSpace) {
    ColorManagement.workingToColorSpace(_color.copy(this), colorSpace);
    const { r, g, b } = _color;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let hue, saturation;
    const lightness = (min + max) / 2;
    if (min === max) {
      hue = 0;
      saturation = 0;
    } else {
      const delta = max - min;
      saturation = lightness <= 0.5 ? delta / (max + min) : delta / (2 - max - min);
      switch (max) {
        case r:
          hue = (g - b) / delta + (g < b ? 6 : 0);
          break;
        case g:
          hue = (b - r) / delta + 2;
          break;
        case b:
          hue = (r - g) / delta + 4;
          break;
      }
      hue /= 6;
    }
    target.h = hue;
    target.s = saturation;
    target.l = lightness;
    return target;
  }
  getRGB(target, colorSpace = ColorManagement.workingColorSpace) {
    ColorManagement.workingToColorSpace(_color.copy(this), colorSpace);
    target.r = _color.r;
    target.g = _color.g;
    target.b = _color.b;
    return target;
  }
  getStyle(colorSpace = SRGBColorSpace) {
    ColorManagement.workingToColorSpace(_color.copy(this), colorSpace);
    const { r, g, b } = _color;
    if (colorSpace !== SRGBColorSpace) {
      return `color(${colorSpace} ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)})`;
    }
    return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
  }
  offsetHSL(h, s, l) {
    this.getHSL(_hslA);
    return this.setHSL(_hslA.h + h, _hslA.s + s, _hslA.l + l);
  }
  add(color) {
    this.r += color.r;
    this.g += color.g;
    this.b += color.b;
    return this;
  }
  addColors(color1, color2) {
    this.r = color1.r + color2.r;
    this.g = color1.g + color2.g;
    this.b = color1.b + color2.b;
    return this;
  }
  addScalar(s) {
    this.r += s;
    this.g += s;
    this.b += s;
    return this;
  }
  sub(color) {
    this.r = Math.max(0, this.r - color.r);
    this.g = Math.max(0, this.g - color.g);
    this.b = Math.max(0, this.b - color.b);
    return this;
  }
  multiply(color) {
    this.r *= color.r;
    this.g *= color.g;
    this.b *= color.b;
    return this;
  }
  multiplyScalar(s) {
    this.r *= s;
    this.g *= s;
    this.b *= s;
    return this;
  }
  lerp(color, alpha) {
    this.r += (color.r - this.r) * alpha;
    this.g += (color.g - this.g) * alpha;
    this.b += (color.b - this.b) * alpha;
    return this;
  }
  lerpColors(color1, color2, alpha) {
    this.r = color1.r + (color2.r - color1.r) * alpha;
    this.g = color1.g + (color2.g - color1.g) * alpha;
    this.b = color1.b + (color2.b - color1.b) * alpha;
    return this;
  }
  lerpHSL(color, alpha) {
    this.getHSL(_hslA);
    color.getHSL(_hslB);
    const h = lerp(_hslA.h, _hslB.h, alpha);
    const s = lerp(_hslA.s, _hslB.s, alpha);
    const l = lerp(_hslA.l, _hslB.l, alpha);
    this.setHSL(h, s, l);
    return this;
  }
  setFromVector3(v) {
    this.r = v.x;
    this.g = v.y;
    this.b = v.z;
    return this;
  }
  applyMatrix3(m) {
    const r = this.r, g = this.g, b = this.b;
    const e = m.elements;
    this.r = e[0] * r + e[3] * g + e[6] * b;
    this.g = e[1] * r + e[4] * g + e[7] * b;
    this.b = e[2] * r + e[5] * g + e[8] * b;
    return this;
  }
  equals(c) {
    return c.r === this.r && c.g === this.g && c.b === this.b;
  }
  fromArray(array, offset = 0) {
    this.r = array[offset];
    this.g = array[offset + 1];
    this.b = array[offset + 2];
    return this;
  }
  toArray(array = [], offset = 0) {
    array[offset] = this.r;
    array[offset + 1] = this.g;
    array[offset + 2] = this.b;
    return array;
  }
  fromBufferAttribute(attribute, index) {
    this.r = attribute.getX(index);
    this.g = attribute.getY(index);
    this.b = attribute.getZ(index);
    return this;
  }
  toJSON() {
    return this.getHex();
  }
  *[Symbol.iterator]() {
    yield this.r;
    yield this.g;
    yield this.b;
  }
}
var _color = /* @__PURE__ */ new Color;
Color.NAMES = _colorKeywords;
class Box3 {
  constructor(min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity)) {
    this.isBox3 = true;
    this.min = min;
    this.max = max;
  }
  set(min, max) {
    this.min.copy(min);
    this.max.copy(max);
    return this;
  }
  setFromArray(array) {
    this.makeEmpty();
    for (let i = 0, il = array.length;i < il; i += 3) {
      this.expandByPoint(_vector$b.fromArray(array, i));
    }
    return this;
  }
  setFromBufferAttribute(attribute) {
    this.makeEmpty();
    for (let i = 0, il = attribute.count;i < il; i++) {
      this.expandByPoint(_vector$b.fromBufferAttribute(attribute, i));
    }
    return this;
  }
  setFromPoints(points) {
    this.makeEmpty();
    for (let i = 0, il = points.length;i < il; i++) {
      this.expandByPoint(points[i]);
    }
    return this;
  }
  setFromCenterAndSize(center, size) {
    const halfSize = _vector$b.copy(size).multiplyScalar(0.5);
    this.min.copy(center).sub(halfSize);
    this.max.copy(center).add(halfSize);
    return this;
  }
  setFromObject(object, precise = false) {
    this.makeEmpty();
    return this.expandByObject(object, precise);
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy(box) {
    this.min.copy(box.min);
    this.max.copy(box.max);
    return this;
  }
  makeEmpty() {
    this.min.x = this.min.y = this.min.z = Infinity;
    this.max.x = this.max.y = this.max.z = -Infinity;
    return this;
  }
  isEmpty() {
    return this.max.x < this.min.x || this.max.y < this.min.y || this.max.z < this.min.z;
  }
  getCenter(target) {
    return this.isEmpty() ? target.set(0, 0, 0) : target.addVectors(this.min, this.max).multiplyScalar(0.5);
  }
  getSize(target) {
    return this.isEmpty() ? target.set(0, 0, 0) : target.subVectors(this.max, this.min);
  }
  expandByPoint(point) {
    this.min.min(point);
    this.max.max(point);
    return this;
  }
  expandByVector(vector) {
    this.min.sub(vector);
    this.max.add(vector);
    return this;
  }
  expandByScalar(scalar) {
    this.min.addScalar(-scalar);
    this.max.addScalar(scalar);
    return this;
  }
  expandByObject(object, precise = false) {
    object.updateWorldMatrix(false, false);
    const geometry = object.geometry;
    if (geometry !== undefined) {
      const positionAttribute = geometry.getAttribute("position");
      if (precise === true && positionAttribute !== undefined && object.isInstancedMesh !== true) {
        for (let i = 0, l = positionAttribute.count;i < l; i++) {
          if (object.isMesh === true) {
            object.getVertexPosition(i, _vector$b);
          } else {
            _vector$b.fromBufferAttribute(positionAttribute, i);
          }
          _vector$b.applyMatrix4(object.matrixWorld);
          this.expandByPoint(_vector$b);
        }
      } else {
        if (object.boundingBox !== undefined) {
          if (object.boundingBox === null) {
            object.computeBoundingBox();
          }
          _box$4.copy(object.boundingBox);
        } else {
          if (geometry.boundingBox === null) {
            geometry.computeBoundingBox();
          }
          _box$4.copy(geometry.boundingBox);
        }
        _box$4.applyMatrix4(object.matrixWorld);
        this.union(_box$4);
      }
    }
    const children = object.children;
    for (let i = 0, l = children.length;i < l; i++) {
      this.expandByObject(children[i], precise);
    }
    return this;
  }
  containsPoint(point) {
    return point.x >= this.min.x && point.x <= this.max.x && point.y >= this.min.y && point.y <= this.max.y && point.z >= this.min.z && point.z <= this.max.z;
  }
  containsBox(box) {
    return this.min.x <= box.min.x && box.max.x <= this.max.x && this.min.y <= box.min.y && box.max.y <= this.max.y && this.min.z <= box.min.z && box.max.z <= this.max.z;
  }
  getParameter(point, target) {
    return target.set((point.x - this.min.x) / (this.max.x - this.min.x), (point.y - this.min.y) / (this.max.y - this.min.y), (point.z - this.min.z) / (this.max.z - this.min.z));
  }
  intersectsBox(box) {
    return box.max.x >= this.min.x && box.min.x <= this.max.x && box.max.y >= this.min.y && box.min.y <= this.max.y && box.max.z >= this.min.z && box.min.z <= this.max.z;
  }
  intersectsSphere(sphere) {
    this.clampPoint(sphere.center, _vector$b);
    return _vector$b.distanceToSquared(sphere.center) <= sphere.radius * sphere.radius;
  }
  intersectsPlane(plane) {
    let min, max;
    if (plane.normal.x > 0) {
      min = plane.normal.x * this.min.x;
      max = plane.normal.x * this.max.x;
    } else {
      min = plane.normal.x * this.max.x;
      max = plane.normal.x * this.min.x;
    }
    if (plane.normal.y > 0) {
      min += plane.normal.y * this.min.y;
      max += plane.normal.y * this.max.y;
    } else {
      min += plane.normal.y * this.max.y;
      max += plane.normal.y * this.min.y;
    }
    if (plane.normal.z > 0) {
      min += plane.normal.z * this.min.z;
      max += plane.normal.z * this.max.z;
    } else {
      min += plane.normal.z * this.max.z;
      max += plane.normal.z * this.min.z;
    }
    return min <= -plane.constant && max >= -plane.constant;
  }
  intersectsTriangle(triangle) {
    if (this.isEmpty()) {
      return false;
    }
    this.getCenter(_center);
    _extents.subVectors(this.max, _center);
    _v0$1.subVectors(triangle.a, _center);
    _v1$4.subVectors(triangle.b, _center);
    _v2$3.subVectors(triangle.c, _center);
    _f0.subVectors(_v1$4, _v0$1);
    _f1.subVectors(_v2$3, _v1$4);
    _f2.subVectors(_v0$1, _v2$3);
    let axes = [
      0,
      -_f0.z,
      _f0.y,
      0,
      -_f1.z,
      _f1.y,
      0,
      -_f2.z,
      _f2.y,
      _f0.z,
      0,
      -_f0.x,
      _f1.z,
      0,
      -_f1.x,
      _f2.z,
      0,
      -_f2.x,
      -_f0.y,
      _f0.x,
      0,
      -_f1.y,
      _f1.x,
      0,
      -_f2.y,
      _f2.x,
      0
    ];
    if (!satForAxes(axes, _v0$1, _v1$4, _v2$3, _extents)) {
      return false;
    }
    axes = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    if (!satForAxes(axes, _v0$1, _v1$4, _v2$3, _extents)) {
      return false;
    }
    _triangleNormal.crossVectors(_f0, _f1);
    axes = [_triangleNormal.x, _triangleNormal.y, _triangleNormal.z];
    return satForAxes(axes, _v0$1, _v1$4, _v2$3, _extents);
  }
  clampPoint(point, target) {
    return target.copy(point).clamp(this.min, this.max);
  }
  distanceToPoint(point) {
    return this.clampPoint(point, _vector$b).distanceTo(point);
  }
  getBoundingSphere(target) {
    if (this.isEmpty()) {
      target.makeEmpty();
    } else {
      this.getCenter(target.center);
      target.radius = this.getSize(_vector$b).length() * 0.5;
    }
    return target;
  }
  intersect(box) {
    this.min.max(box.min);
    this.max.min(box.max);
    if (this.isEmpty())
      this.makeEmpty();
    return this;
  }
  union(box) {
    this.min.min(box.min);
    this.max.max(box.max);
    return this;
  }
  applyMatrix4(matrix) {
    if (this.isEmpty())
      return this;
    _points[0].set(this.min.x, this.min.y, this.min.z).applyMatrix4(matrix);
    _points[1].set(this.min.x, this.min.y, this.max.z).applyMatrix4(matrix);
    _points[2].set(this.min.x, this.max.y, this.min.z).applyMatrix4(matrix);
    _points[3].set(this.min.x, this.max.y, this.max.z).applyMatrix4(matrix);
    _points[4].set(this.max.x, this.min.y, this.min.z).applyMatrix4(matrix);
    _points[5].set(this.max.x, this.min.y, this.max.z).applyMatrix4(matrix);
    _points[6].set(this.max.x, this.max.y, this.min.z).applyMatrix4(matrix);
    _points[7].set(this.max.x, this.max.y, this.max.z).applyMatrix4(matrix);
    this.setFromPoints(_points);
    return this;
  }
  translate(offset) {
    this.min.add(offset);
    this.max.add(offset);
    return this;
  }
  equals(box) {
    return box.min.equals(this.min) && box.max.equals(this.max);
  }
  toJSON() {
    return {
      min: this.min.toArray(),
      max: this.max.toArray()
    };
  }
  fromJSON(json) {
    this.min.fromArray(json.min);
    this.max.fromArray(json.max);
    return this;
  }
}
var _points = [
  /* @__PURE__ */ new Vector3,
  /* @__PURE__ */ new Vector3,
  /* @__PURE__ */ new Vector3,
  /* @__PURE__ */ new Vector3,
  /* @__PURE__ */ new Vector3,
  /* @__PURE__ */ new Vector3,
  /* @__PURE__ */ new Vector3,
  /* @__PURE__ */ new Vector3
];
var _vector$b = /* @__PURE__ */ new Vector3;
var _box$4 = /* @__PURE__ */ new Box3;
var _v0$1 = /* @__PURE__ */ new Vector3;
var _v1$4 = /* @__PURE__ */ new Vector3;
var _v2$3 = /* @__PURE__ */ new Vector3;
var _f0 = /* @__PURE__ */ new Vector3;
var _f1 = /* @__PURE__ */ new Vector3;
var _f2 = /* @__PURE__ */ new Vector3;
var _center = /* @__PURE__ */ new Vector3;
var _extents = /* @__PURE__ */ new Vector3;
var _triangleNormal = /* @__PURE__ */ new Vector3;
var _testAxis = /* @__PURE__ */ new Vector3;
function satForAxes(axes, v0, v1, v2, extents) {
  for (let i = 0, j = axes.length - 3;i <= j; i += 3) {
    _testAxis.fromArray(axes, i);
    const r = extents.x * Math.abs(_testAxis.x) + extents.y * Math.abs(_testAxis.y) + extents.z * Math.abs(_testAxis.z);
    const p0 = v0.dot(_testAxis);
    const p1 = v1.dot(_testAxis);
    const p2 = v2.dot(_testAxis);
    if (Math.max(-Math.max(p0, p1, p2), Math.min(p0, p1, p2)) > r) {
      return false;
    }
  }
  return true;
}
var _vector$a = /* @__PURE__ */ new Vector3;
var _vector2$1 = /* @__PURE__ */ new Vector2;
var _id$2 = 0;

class BufferAttribute extends EventDispatcher {
  constructor(array, itemSize, normalized = false) {
    super();
    if (Array.isArray(array)) {
      throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");
    }
    this.isBufferAttribute = true;
    Object.defineProperty(this, "id", { value: _id$2++ });
    this.name = "";
    this.array = array;
    this.itemSize = itemSize;
    this.count = array !== undefined ? array.length / itemSize : 0;
    this.normalized = normalized;
    this.usage = StaticDrawUsage;
    this.updateRanges = [];
    this.gpuType = FloatType;
    this.version = 0;
  }
  onUploadCallback() {}
  set needsUpdate(value) {
    if (value === true)
      this.version++;
  }
  setUsage(value) {
    this.usage = value;
    return this;
  }
  addUpdateRange(start, count) {
    this.updateRanges.push({ start, count });
  }
  clearUpdateRanges() {
    this.updateRanges.length = 0;
  }
  copy(source) {
    this.name = source.name;
    this.array = new source.array.constructor(source.array);
    this.itemSize = source.itemSize;
    this.count = source.count;
    this.normalized = source.normalized;
    this.usage = source.usage;
    this.gpuType = source.gpuType;
    return this;
  }
  copyAt(index1, attribute, index2) {
    index1 *= this.itemSize;
    index2 *= attribute.itemSize;
    for (let i = 0, l = this.itemSize;i < l; i++) {
      this.array[index1 + i] = attribute.array[index2 + i];
    }
    return this;
  }
  copyArray(array) {
    this.array.set(array);
    return this;
  }
  applyMatrix3(m) {
    if (this.itemSize === 2) {
      for (let i = 0, l = this.count;i < l; i++) {
        _vector2$1.fromBufferAttribute(this, i);
        _vector2$1.applyMatrix3(m);
        this.setXY(i, _vector2$1.x, _vector2$1.y);
      }
    } else if (this.itemSize === 3) {
      for (let i = 0, l = this.count;i < l; i++) {
        _vector$a.fromBufferAttribute(this, i);
        _vector$a.applyMatrix3(m);
        this.setXYZ(i, _vector$a.x, _vector$a.y, _vector$a.z);
      }
    }
    return this;
  }
  applyMatrix4(m) {
    for (let i = 0, l = this.count;i < l; i++) {
      _vector$a.fromBufferAttribute(this, i);
      _vector$a.applyMatrix4(m);
      this.setXYZ(i, _vector$a.x, _vector$a.y, _vector$a.z);
    }
    return this;
  }
  applyNormalMatrix(m) {
    for (let i = 0, l = this.count;i < l; i++) {
      _vector$a.fromBufferAttribute(this, i);
      _vector$a.applyNormalMatrix(m);
      this.setXYZ(i, _vector$a.x, _vector$a.y, _vector$a.z);
    }
    return this;
  }
  transformDirection(m) {
    for (let i = 0, l = this.count;i < l; i++) {
      _vector$a.fromBufferAttribute(this, i);
      _vector$a.transformDirection(m);
      this.setXYZ(i, _vector$a.x, _vector$a.y, _vector$a.z);
    }
    return this;
  }
  set(value, offset = 0) {
    this.array.set(value, offset);
    return this;
  }
  getComponent(index, component) {
    let value = this.array[index * this.itemSize + component];
    if (this.normalized)
      value = denormalize(value, this.array);
    return value;
  }
  setComponent(index, component, value) {
    if (this.normalized)
      value = normalize(value, this.array);
    this.array[index * this.itemSize + component] = value;
    return this;
  }
  getX(index) {
    let x = this.array[index * this.itemSize];
    if (this.normalized)
      x = denormalize(x, this.array);
    return x;
  }
  setX(index, x) {
    if (this.normalized)
      x = normalize(x, this.array);
    this.array[index * this.itemSize] = x;
    return this;
  }
  getY(index) {
    let y = this.array[index * this.itemSize + 1];
    if (this.normalized)
      y = denormalize(y, this.array);
    return y;
  }
  setY(index, y) {
    if (this.normalized)
      y = normalize(y, this.array);
    this.array[index * this.itemSize + 1] = y;
    return this;
  }
  getZ(index) {
    let z = this.array[index * this.itemSize + 2];
    if (this.normalized)
      z = denormalize(z, this.array);
    return z;
  }
  setZ(index, z) {
    if (this.normalized)
      z = normalize(z, this.array);
    this.array[index * this.itemSize + 2] = z;
    return this;
  }
  getW(index) {
    let w = this.array[index * this.itemSize + 3];
    if (this.normalized)
      w = denormalize(w, this.array);
    return w;
  }
  setW(index, w) {
    if (this.normalized)
      w = normalize(w, this.array);
    this.array[index * this.itemSize + 3] = w;
    return this;
  }
  setXY(index, x, y) {
    index *= this.itemSize;
    if (this.normalized) {
      x = normalize(x, this.array);
      y = normalize(y, this.array);
    }
    this.array[index + 0] = x;
    this.array[index + 1] = y;
    return this;
  }
  setXYZ(index, x, y, z) {
    index *= this.itemSize;
    if (this.normalized) {
      x = normalize(x, this.array);
      y = normalize(y, this.array);
      z = normalize(z, this.array);
    }
    this.array[index + 0] = x;
    this.array[index + 1] = y;
    this.array[index + 2] = z;
    return this;
  }
  setXYZW(index, x, y, z, w) {
    index *= this.itemSize;
    if (this.normalized) {
      x = normalize(x, this.array);
      y = normalize(y, this.array);
      z = normalize(z, this.array);
      w = normalize(w, this.array);
    }
    this.array[index + 0] = x;
    this.array[index + 1] = y;
    this.array[index + 2] = z;
    this.array[index + 3] = w;
    return this;
  }
  onUpload(callback) {
    this.onUploadCallback = callback;
    return this;
  }
  clone() {
    return new this.constructor(this.array, this.itemSize).copy(this);
  }
  toJSON() {
    const data = {
      itemSize: this.itemSize,
      type: this.array.constructor.name,
      array: Array.from(this.array),
      normalized: this.normalized
    };
    if (this.name !== "")
      data.name = this.name;
    if (this.usage !== StaticDrawUsage)
      data.usage = this.usage;
    return data;
  }
  dispose() {
    this.dispatchEvent({ type: "dispose" });
  }
}
class Uint16BufferAttribute extends BufferAttribute {
  constructor(array, itemSize, normalized) {
    super(new Uint16Array(array), itemSize, normalized);
  }
}
class Uint32BufferAttribute extends BufferAttribute {
  constructor(array, itemSize, normalized) {
    super(new Uint32Array(array), itemSize, normalized);
  }
}
class Float32BufferAttribute extends BufferAttribute {
  constructor(array, itemSize, normalized) {
    super(new Float32Array(array), itemSize, normalized);
  }
}
var _box$3 = /* @__PURE__ */ new Box3;
var _v1$3 = /* @__PURE__ */ new Vector3;
var _v2$2 = /* @__PURE__ */ new Vector3;

class Sphere {
  constructor(center = new Vector3, radius = -1) {
    this.isSphere = true;
    this.center = center;
    this.radius = radius;
  }
  set(center, radius) {
    this.center.copy(center);
    this.radius = radius;
    return this;
  }
  setFromPoints(points, optionalCenter) {
    const center = this.center;
    if (optionalCenter !== undefined) {
      center.copy(optionalCenter);
    } else {
      _box$3.setFromPoints(points).getCenter(center);
    }
    let maxRadiusSq = 0;
    for (let i = 0, il = points.length;i < il; i++) {
      maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(points[i]));
    }
    this.radius = Math.sqrt(maxRadiusSq);
    return this;
  }
  copy(sphere) {
    this.center.copy(sphere.center);
    this.radius = sphere.radius;
    return this;
  }
  isEmpty() {
    return this.radius < 0;
  }
  makeEmpty() {
    this.center.set(0, 0, 0);
    this.radius = -1;
    return this;
  }
  containsPoint(point) {
    return point.distanceToSquared(this.center) <= this.radius * this.radius;
  }
  distanceToPoint(point) {
    return point.distanceTo(this.center) - this.radius;
  }
  intersectsSphere(sphere) {
    const radiusSum = this.radius + sphere.radius;
    return sphere.center.distanceToSquared(this.center) <= radiusSum * radiusSum;
  }
  intersectsBox(box) {
    return box.intersectsSphere(this);
  }
  intersectsPlane(plane) {
    return Math.abs(plane.distanceToPoint(this.center)) <= this.radius;
  }
  clampPoint(point, target) {
    const deltaLengthSq = this.center.distanceToSquared(point);
    target.copy(point);
    if (deltaLengthSq > this.radius * this.radius) {
      target.sub(this.center).normalize();
      target.multiplyScalar(this.radius).add(this.center);
    }
    return target;
  }
  getBoundingBox(target) {
    if (this.isEmpty()) {
      target.makeEmpty();
      return target;
    }
    target.set(this.center, this.center);
    target.expandByScalar(this.radius);
    return target;
  }
  applyMatrix4(matrix) {
    this.center.applyMatrix4(matrix);
    this.radius = this.radius * matrix.getMaxScaleOnAxis();
    return this;
  }
  translate(offset) {
    this.center.add(offset);
    return this;
  }
  expandByPoint(point) {
    if (this.isEmpty()) {
      this.center.copy(point);
      this.radius = 0;
      return this;
    }
    _v1$3.subVectors(point, this.center);
    const lengthSq = _v1$3.lengthSq();
    if (lengthSq > this.radius * this.radius) {
      const length = Math.sqrt(lengthSq);
      const delta = (length - this.radius) * 0.5;
      this.center.addScaledVector(_v1$3, delta / length);
      this.radius += delta;
    }
    return this;
  }
  union(sphere) {
    if (sphere.isEmpty()) {
      return this;
    }
    if (this.isEmpty()) {
      this.copy(sphere);
      return this;
    }
    if (this.center.equals(sphere.center) === true) {
      this.radius = Math.max(this.radius, sphere.radius);
    } else {
      _v2$2.subVectors(sphere.center, this.center).setLength(sphere.radius);
      this.expandByPoint(_v1$3.copy(sphere.center).add(_v2$2));
      this.expandByPoint(_v1$3.copy(sphere.center).sub(_v2$2));
    }
    return this;
  }
  equals(sphere) {
    return sphere.center.equals(this.center) && sphere.radius === this.radius;
  }
  clone() {
    return new this.constructor().copy(this);
  }
  toJSON() {
    return {
      radius: this.radius,
      center: this.center.toArray()
    };
  }
  fromJSON(json) {
    this.radius = json.radius;
    this.center.fromArray(json.center);
    return this;
  }
}
var _id$1 = 0;
var _m1 = /* @__PURE__ */ new Matrix4;
var _obj = /* @__PURE__ */ new Object3D;
var _offset = /* @__PURE__ */ new Vector3;
var _box$2 = /* @__PURE__ */ new Box3;
var _boxMorphTargets = /* @__PURE__ */ new Box3;
var _vector$9 = /* @__PURE__ */ new Vector3;

class BufferGeometry extends EventDispatcher {
  constructor() {
    super();
    this.isBufferGeometry = true;
    Object.defineProperty(this, "id", { value: _id$1++ });
    this.uuid = generateUUID();
    this.name = "";
    this.type = "BufferGeometry";
    this.index = null;
    this.indirect = null;
    this.indirectOffset = 0;
    this.attributes = {};
    this.morphAttributes = {};
    this.morphTargetsRelative = false;
    this.groups = [];
    this.boundingBox = null;
    this.boundingSphere = null;
    this.drawRange = { start: 0, count: Infinity };
    this.userData = {};
    this._transformed = false;
  }
  getIndex() {
    return this.index;
  }
  setIndex(index) {
    if (Array.isArray(index)) {
      this.index = new ((arrayNeedsUint32(index)) ? Uint32BufferAttribute : Uint16BufferAttribute)(index, 1);
    } else {
      this.index = index;
    }
    return this;
  }
  setIndirect(indirect, indirectOffset = 0) {
    this.indirect = indirect;
    this.indirectOffset = indirectOffset;
    return this;
  }
  getIndirect() {
    return this.indirect;
  }
  getAttribute(name) {
    return this.attributes[name];
  }
  setAttribute(name, attribute) {
    this.attributes[name] = attribute;
    return this;
  }
  deleteAttribute(name) {
    delete this.attributes[name];
    return this;
  }
  hasAttribute(name) {
    return this.attributes[name] !== undefined;
  }
  addGroup(start, count, materialIndex = 0) {
    this.groups.push({
      start,
      count,
      materialIndex
    });
  }
  clearGroups() {
    this.groups = [];
  }
  setDrawRange(start, count) {
    this.drawRange.start = start;
    this.drawRange.count = count;
  }
  applyMatrix4(matrix) {
    const position = this.attributes.position;
    if (position !== undefined) {
      position.applyMatrix4(matrix);
      position.needsUpdate = true;
    }
    const normal = this.attributes.normal;
    if (normal !== undefined) {
      const normalMatrix = new Matrix3().getNormalMatrix(matrix);
      normal.applyNormalMatrix(normalMatrix);
      normal.needsUpdate = true;
    }
    const tangent = this.attributes.tangent;
    if (tangent !== undefined) {
      tangent.transformDirection(matrix);
      tangent.needsUpdate = true;
    }
    if (this.boundingBox !== null) {
      this.computeBoundingBox();
    }
    if (this.boundingSphere !== null) {
      this.computeBoundingSphere();
    }
    this._transformed = true;
    return this;
  }
  applyQuaternion(q) {
    _m1.makeRotationFromQuaternion(q);
    this.applyMatrix4(_m1);
    return this;
  }
  rotateX(angle) {
    _m1.makeRotationX(angle);
    this.applyMatrix4(_m1);
    return this;
  }
  rotateY(angle) {
    _m1.makeRotationY(angle);
    this.applyMatrix4(_m1);
    return this;
  }
  rotateZ(angle) {
    _m1.makeRotationZ(angle);
    this.applyMatrix4(_m1);
    return this;
  }
  translate(x, y, z) {
    _m1.makeTranslation(x, y, z);
    this.applyMatrix4(_m1);
    return this;
  }
  scale(x, y, z) {
    _m1.makeScale(x, y, z);
    this.applyMatrix4(_m1);
    return this;
  }
  lookAt(vector) {
    _obj.lookAt(vector);
    _obj.updateMatrix();
    this.applyMatrix4(_obj.matrix);
    return this;
  }
  center() {
    this.computeBoundingBox();
    this.boundingBox.getCenter(_offset).negate();
    this.translate(_offset.x, _offset.y, _offset.z);
    return this;
  }
  setFromPoints(points) {
    const positionAttribute = this.getAttribute("position");
    if (positionAttribute === undefined) {
      const position = [];
      for (let i = 0, l = points.length;i < l; i++) {
        const point = points[i];
        position.push(point.x, point.y, point.z || 0);
      }
      this.setAttribute("position", new Float32BufferAttribute(position, 3));
    } else {
      const l = Math.min(points.length, positionAttribute.count);
      for (let i = 0;i < l; i++) {
        const point = points[i];
        positionAttribute.setXYZ(i, point.x, point.y, point.z || 0);
      }
      if (points.length > positionAttribute.count) {
        warn("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry.");
      }
      positionAttribute.needsUpdate = true;
    }
    return this;
  }
  computeBoundingBox() {
    if (this.boundingBox === null) {
      this.boundingBox = new Box3;
    }
    const position = this.attributes.position;
    const morphAttributesPosition = this.morphAttributes.position;
    if (position && position.isGLBufferAttribute) {
      error("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.", this);
      this.boundingBox.set(new Vector3(-Infinity, -Infinity, -Infinity), new Vector3(Infinity, Infinity, Infinity));
      return;
    }
    if (position !== undefined) {
      this.boundingBox.setFromBufferAttribute(position);
      if (morphAttributesPosition) {
        for (let i = 0, il = morphAttributesPosition.length;i < il; i++) {
          const morphAttribute = morphAttributesPosition[i];
          _box$2.setFromBufferAttribute(morphAttribute);
          if (this.morphTargetsRelative) {
            _vector$9.addVectors(this.boundingBox.min, _box$2.min);
            this.boundingBox.expandByPoint(_vector$9);
            _vector$9.addVectors(this.boundingBox.max, _box$2.max);
            this.boundingBox.expandByPoint(_vector$9);
          } else {
            this.boundingBox.expandByPoint(_box$2.min);
            this.boundingBox.expandByPoint(_box$2.max);
          }
        }
      }
    } else {
      this.boundingBox.makeEmpty();
    }
    if (isNaN(this.boundingBox.min.x) || isNaN(this.boundingBox.min.y) || isNaN(this.boundingBox.min.z)) {
      error('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.', this);
    }
  }
  computeBoundingSphere() {
    if (this.boundingSphere === null) {
      this.boundingSphere = new Sphere;
    }
    const position = this.attributes.position;
    const morphAttributesPosition = this.morphAttributes.position;
    if (position && position.isGLBufferAttribute) {
      error("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.", this);
      this.boundingSphere.set(new Vector3, Infinity);
      return;
    }
    if (position) {
      const center = this.boundingSphere.center;
      _box$2.setFromBufferAttribute(position);
      if (morphAttributesPosition) {
        for (let i = 0, il = morphAttributesPosition.length;i < il; i++) {
          const morphAttribute = morphAttributesPosition[i];
          _boxMorphTargets.setFromBufferAttribute(morphAttribute);
          if (this.morphTargetsRelative) {
            _vector$9.addVectors(_box$2.min, _boxMorphTargets.min);
            _box$2.expandByPoint(_vector$9);
            _vector$9.addVectors(_box$2.max, _boxMorphTargets.max);
            _box$2.expandByPoint(_vector$9);
          } else {
            _box$2.expandByPoint(_boxMorphTargets.min);
            _box$2.expandByPoint(_boxMorphTargets.max);
          }
        }
      }
      _box$2.getCenter(center);
      let maxRadiusSq = 0;
      for (let i = 0, il = position.count;i < il; i++) {
        _vector$9.fromBufferAttribute(position, i);
        maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(_vector$9));
      }
      if (morphAttributesPosition) {
        for (let i = 0, il = morphAttributesPosition.length;i < il; i++) {
          const morphAttribute = morphAttributesPosition[i];
          const morphTargetsRelative = this.morphTargetsRelative;
          for (let j = 0, jl = morphAttribute.count;j < jl; j++) {
            _vector$9.fromBufferAttribute(morphAttribute, j);
            if (morphTargetsRelative) {
              _offset.fromBufferAttribute(position, j);
              _vector$9.add(_offset);
            }
            maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(_vector$9));
          }
        }
      }
      this.boundingSphere.radius = Math.sqrt(maxRadiusSq);
      if (isNaN(this.boundingSphere.radius)) {
        error('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.', this);
      }
    }
  }
  computeTangents() {
    const index = this.index;
    const attributes = this.attributes;
    if (index === null || attributes.position === undefined || attributes.normal === undefined || attributes.uv === undefined) {
      error("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");
      return;
    }
    const positionAttribute = attributes.position;
    const normalAttribute = attributes.normal;
    const uvAttribute = attributes.uv;
    let tangentAttribute = this.getAttribute("tangent");
    if (tangentAttribute === undefined || tangentAttribute.count !== positionAttribute.count) {
      tangentAttribute = new BufferAttribute(new Float32Array(4 * positionAttribute.count), 4);
      this.setAttribute("tangent", tangentAttribute);
    }
    const tan1 = [], tan2 = [];
    for (let i = 0;i < positionAttribute.count; i++) {
      tan1[i] = new Vector3;
      tan2[i] = new Vector3;
    }
    const vA = new Vector3, vB = new Vector3, vC = new Vector3, uvA = new Vector2, uvB = new Vector2, uvC = new Vector2, sdir = new Vector3, tdir = new Vector3;
    function handleTriangle(a, b, c) {
      vA.fromBufferAttribute(positionAttribute, a);
      vB.fromBufferAttribute(positionAttribute, b);
      vC.fromBufferAttribute(positionAttribute, c);
      uvA.fromBufferAttribute(uvAttribute, a);
      uvB.fromBufferAttribute(uvAttribute, b);
      uvC.fromBufferAttribute(uvAttribute, c);
      vB.sub(vA);
      vC.sub(vA);
      uvB.sub(uvA);
      uvC.sub(uvA);
      const r = 1 / (uvB.x * uvC.y - uvC.x * uvB.y);
      if (!isFinite(r))
        return;
      sdir.copy(vB).multiplyScalar(uvC.y).addScaledVector(vC, -uvB.y).multiplyScalar(r);
      tdir.copy(vC).multiplyScalar(uvB.x).addScaledVector(vB, -uvC.x).multiplyScalar(r);
      tan1[a].add(sdir);
      tan1[b].add(sdir);
      tan1[c].add(sdir);
      tan2[a].add(tdir);
      tan2[b].add(tdir);
      tan2[c].add(tdir);
    }
    let groups = this.groups;
    if (groups.length === 0) {
      groups = [{
        start: 0,
        count: index.count
      }];
    }
    for (let i = 0, il = groups.length;i < il; ++i) {
      const group = groups[i];
      const start = group.start;
      const count = group.count;
      for (let j = start, jl = start + count;j < jl; j += 3) {
        handleTriangle(index.getX(j + 0), index.getX(j + 1), index.getX(j + 2));
      }
    }
    const tmp = new Vector3, tmp2 = new Vector3;
    const n = new Vector3, n2 = new Vector3;
    function handleVertex(v) {
      n.fromBufferAttribute(normalAttribute, v);
      n2.copy(n);
      const t = tan1[v];
      tmp.copy(t);
      tmp.sub(n.multiplyScalar(n.dot(t))).normalize();
      tmp2.crossVectors(n2, t);
      const test = tmp2.dot(tan2[v]);
      const w = test < 0 ? -1 : 1;
      tangentAttribute.setXYZW(v, tmp.x, tmp.y, tmp.z, w);
    }
    for (let i = 0, il = groups.length;i < il; ++i) {
      const group = groups[i];
      const start = group.start;
      const count = group.count;
      for (let j = start, jl = start + count;j < jl; j += 3) {
        handleVertex(index.getX(j + 0));
        handleVertex(index.getX(j + 1));
        handleVertex(index.getX(j + 2));
      }
    }
    this._transformed = true;
  }
  computeVertexNormals() {
    const index = this.index;
    const positionAttribute = this.getAttribute("position");
    if (positionAttribute !== undefined) {
      let normalAttribute = this.getAttribute("normal");
      if (normalAttribute === undefined || normalAttribute.count !== positionAttribute.count) {
        normalAttribute = new BufferAttribute(new Float32Array(positionAttribute.count * 3), 3);
        this.setAttribute("normal", normalAttribute);
      } else {
        for (let i = 0, il = normalAttribute.count;i < il; i++) {
          normalAttribute.setXYZ(i, 0, 0, 0);
        }
      }
      const pA = new Vector3, pB = new Vector3, pC = new Vector3;
      const nA = new Vector3, nB = new Vector3, nC = new Vector3;
      const cb = new Vector3, ab = new Vector3;
      if (index) {
        for (let i = 0, il = index.count;i < il; i += 3) {
          const vA = index.getX(i + 0);
          const vB = index.getX(i + 1);
          const vC = index.getX(i + 2);
          pA.fromBufferAttribute(positionAttribute, vA);
          pB.fromBufferAttribute(positionAttribute, vB);
          pC.fromBufferAttribute(positionAttribute, vC);
          cb.subVectors(pC, pB);
          ab.subVectors(pA, pB);
          cb.cross(ab);
          nA.fromBufferAttribute(normalAttribute, vA);
          nB.fromBufferAttribute(normalAttribute, vB);
          nC.fromBufferAttribute(normalAttribute, vC);
          nA.add(cb);
          nB.add(cb);
          nC.add(cb);
          normalAttribute.setXYZ(vA, nA.x, nA.y, nA.z);
          normalAttribute.setXYZ(vB, nB.x, nB.y, nB.z);
          normalAttribute.setXYZ(vC, nC.x, nC.y, nC.z);
        }
      } else {
        for (let i = 0, il = positionAttribute.count;i < il; i += 3) {
          pA.fromBufferAttribute(positionAttribute, i + 0);
          pB.fromBufferAttribute(positionAttribute, i + 1);
          pC.fromBufferAttribute(positionAttribute, i + 2);
          cb.subVectors(pC, pB);
          ab.subVectors(pA, pB);
          cb.cross(ab);
          normalAttribute.setXYZ(i + 0, cb.x, cb.y, cb.z);
          normalAttribute.setXYZ(i + 1, cb.x, cb.y, cb.z);
          normalAttribute.setXYZ(i + 2, cb.x, cb.y, cb.z);
        }
      }
      this.normalizeNormals();
      normalAttribute.needsUpdate = true;
    }
  }
  normalizeNormals() {
    const normals = this.attributes.normal;
    for (let i = 0, il = normals.count;i < il; i++) {
      _vector$9.fromBufferAttribute(normals, i);
      _vector$9.normalize();
      normals.setXYZ(i, _vector$9.x, _vector$9.y, _vector$9.z);
    }
  }
  toNonIndexed() {
    function convertBufferAttribute(attribute, indices2) {
      const array = attribute.array;
      const itemSize = attribute.itemSize;
      const normalized = attribute.normalized;
      const array2 = new array.constructor(indices2.length * itemSize);
      let index = 0, index2 = 0;
      for (let i = 0, l = indices2.length;i < l; i++) {
        if (attribute.isInterleavedBufferAttribute) {
          index = indices2[i] * attribute.data.stride + attribute.offset;
        } else {
          index = indices2[i] * itemSize;
        }
        for (let j = 0;j < itemSize; j++) {
          array2[index2++] = array[index++];
        }
      }
      return new BufferAttribute(array2, itemSize, normalized);
    }
    if (this.index === null) {
      warn("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed.");
      return this;
    }
    const geometry2 = new BufferGeometry;
    const indices = this.index.array;
    const attributes = this.attributes;
    for (const name in attributes) {
      const attribute = attributes[name];
      const newAttribute = convertBufferAttribute(attribute, indices);
      geometry2.setAttribute(name, newAttribute);
    }
    const morphAttributes = this.morphAttributes;
    for (const name in morphAttributes) {
      const morphArray = [];
      const morphAttribute = morphAttributes[name];
      for (let i = 0, il = morphAttribute.length;i < il; i++) {
        const attribute = morphAttribute[i];
        const newAttribute = convertBufferAttribute(attribute, indices);
        morphArray.push(newAttribute);
      }
      geometry2.morphAttributes[name] = morphArray;
    }
    geometry2.morphTargetsRelative = this.morphTargetsRelative;
    const groups = this.groups;
    for (let i = 0, l = groups.length;i < l; i++) {
      const group = groups[i];
      geometry2.addGroup(group.start, group.count, group.materialIndex);
    }
    return geometry2;
  }
  toJSON() {
    const data = {
      metadata: {
        version: 4.7,
        type: "BufferGeometry",
        generator: "BufferGeometry.toJSON"
      }
    };
    data.uuid = this.uuid;
    data.type = this.parameters !== undefined && this._transformed === true ? "BufferGeometry" : this.type;
    if (this.name !== "")
      data.name = this.name;
    if (Object.keys(this.userData).length > 0)
      data.userData = this.userData;
    if (this.parameters !== undefined && this._transformed !== true) {
      const parameters = this.parameters;
      for (const key in parameters) {
        if (parameters[key] !== undefined)
          data[key] = parameters[key];
      }
      return data;
    }
    data.data = { attributes: {} };
    const index = this.index;
    if (index !== null) {
      data.data.index = {
        type: index.array.constructor.name,
        array: Array.prototype.slice.call(index.array)
      };
    }
    const attributes = this.attributes;
    for (const key in attributes) {
      const attribute = attributes[key];
      data.data.attributes[key] = attribute.toJSON(data.data);
    }
    const morphAttributes = {};
    let hasMorphAttributes = false;
    for (const key in this.morphAttributes) {
      const attributeArray = this.morphAttributes[key];
      const array = [];
      for (let i = 0, il = attributeArray.length;i < il; i++) {
        const attribute = attributeArray[i];
        array.push(attribute.toJSON(data.data));
      }
      if (array.length > 0) {
        morphAttributes[key] = array;
        hasMorphAttributes = true;
      }
    }
    if (hasMorphAttributes) {
      data.data.morphAttributes = morphAttributes;
      data.data.morphTargetsRelative = this.morphTargetsRelative;
    }
    const groups = this.groups;
    if (groups.length > 0) {
      data.data.groups = JSON.parse(JSON.stringify(groups));
    }
    const boundingSphere = this.boundingSphere;
    if (boundingSphere !== null) {
      data.data.boundingSphere = boundingSphere.toJSON();
    }
    return data;
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy(source) {
    this.index = null;
    this.attributes = {};
    this.morphAttributes = {};
    this.groups = [];
    this.boundingBox = null;
    this.boundingSphere = null;
    const data = {};
    this.name = source.name;
    const index = source.index;
    if (index !== null) {
      this.setIndex(index.clone());
    }
    const attributes = source.attributes;
    for (const name in attributes) {
      const attribute = attributes[name];
      this.setAttribute(name, attribute.clone(data));
    }
    const morphAttributes = source.morphAttributes;
    for (const name in morphAttributes) {
      const array = [];
      const morphAttribute = morphAttributes[name];
      for (let i = 0, l = morphAttribute.length;i < l; i++) {
        array.push(morphAttribute[i].clone(data));
      }
      this.morphAttributes[name] = array;
    }
    this.morphTargetsRelative = source.morphTargetsRelative;
    const groups = source.groups;
    for (let i = 0, l = groups.length;i < l; i++) {
      const group = groups[i];
      this.addGroup(group.start, group.count, group.materialIndex);
    }
    const boundingBox = source.boundingBox;
    if (boundingBox !== null) {
      this.boundingBox = boundingBox.clone();
    }
    const boundingSphere = source.boundingSphere;
    if (boundingSphere !== null) {
      this.boundingSphere = boundingSphere.clone();
    }
    this.drawRange.start = source.drawRange.start;
    this.drawRange.count = source.drawRange.count;
    this.userData = source.userData;
    this._transformed = source._transformed;
    return this;
  }
  dispose() {
    this.dispatchEvent({ type: "dispose" });
  }
}
function cloneUniforms(src) {
  const dst = {};
  for (const u in src) {
    dst[u] = {};
    for (const p in src[u]) {
      const property = src[u][p];
      if (isThreeObject(property)) {
        if (property.isRenderTargetTexture) {
          warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms().");
          dst[u][p] = null;
        } else {
          dst[u][p] = property.clone();
        }
      } else if (Array.isArray(property)) {
        if (isThreeObject(property[0])) {
          const clonedProperty = [];
          for (let i = 0, l = property.length;i < l; i++) {
            clonedProperty[i] = property[i].clone();
          }
          dst[u][p] = clonedProperty;
        } else {
          dst[u][p] = property.slice();
        }
      } else {
        dst[u][p] = property;
      }
    }
  }
  return dst;
}
function mergeUniforms(uniforms) {
  const merged = {};
  for (let u = 0;u < uniforms.length; u++) {
    const tmp = cloneUniforms(uniforms[u]);
    for (const p in tmp) {
      merged[p] = tmp[p];
    }
  }
  return merged;
}
function isThreeObject(property) {
  return property && (property.isColor || property.isMatrix3 || property.isMatrix4 || property.isVector2 || property.isVector3 || property.isVector4 || property.isTexture || property.isQuaternion);
}
function convertArray(array, type) {
  if (!array || array.constructor === type)
    return array;
  if (typeof type.BYTES_PER_ELEMENT === "number") {
    return new type(array);
  }
  return Array.prototype.slice.call(array);
}
class Interpolant {
  constructor(parameterPositions, sampleValues, sampleSize, resultBuffer) {
    this.parameterPositions = parameterPositions;
    this._cachedIndex = 0;
    this.resultBuffer = resultBuffer !== undefined ? resultBuffer : new sampleValues.constructor(sampleSize);
    this.sampleValues = sampleValues;
    this.valueSize = sampleSize;
    this.settings = null;
    this.DefaultSettings_ = {};
  }
  evaluate(t) {
    const pp = this.parameterPositions;
    let i1 = this._cachedIndex, t1 = pp[i1], t0 = pp[i1 - 1];
    validate_interval: {
      seek: {
        let right;
        linear_scan: {
          forward_scan:
            if (!(t < t1)) {
              for (let giveUpAt = i1 + 2;; ) {
                if (t1 === undefined) {
                  if (t < t0)
                    break forward_scan;
                  i1 = pp.length;
                  this._cachedIndex = i1;
                  return this.copySampleValue_(i1 - 1);
                }
                if (i1 === giveUpAt)
                  break;
                t0 = t1;
                t1 = pp[++i1];
                if (t < t1) {
                  break seek;
                }
              }
              right = pp.length;
              break linear_scan;
            }
          if (!(t >= t0)) {
            const t1global = pp[1];
            if (t < t1global) {
              i1 = 2;
              t0 = t1global;
            }
            for (let giveUpAt = i1 - 2;; ) {
              if (t0 === undefined) {
                this._cachedIndex = 0;
                return this.copySampleValue_(0);
              }
              if (i1 === giveUpAt)
                break;
              t1 = t0;
              t0 = pp[--i1 - 1];
              if (t >= t0) {
                break seek;
              }
            }
            right = i1;
            i1 = 0;
            break linear_scan;
          }
          break validate_interval;
        }
        while (i1 < right) {
          const mid = i1 + right >>> 1;
          if (t < pp[mid]) {
            right = mid;
          } else {
            i1 = mid + 1;
          }
        }
        t1 = pp[i1];
        t0 = pp[i1 - 1];
        if (t0 === undefined) {
          this._cachedIndex = 0;
          return this.copySampleValue_(0);
        }
        if (t1 === undefined) {
          i1 = pp.length;
          this._cachedIndex = i1;
          return this.copySampleValue_(i1 - 1);
        }
      }
      this._cachedIndex = i1;
      this.intervalChanged_(i1, t0, t1);
    }
    return this.interpolate_(i1, t0, t, t1);
  }
  getSettings_() {
    return this.settings || this.DefaultSettings_;
  }
  copySampleValue_(index) {
    const result = this.resultBuffer, values = this.sampleValues, stride = this.valueSize, offset = index * stride;
    for (let i = 0;i !== stride; ++i) {
      result[i] = values[offset + i];
    }
    return result;
  }
  interpolate_() {
    throw new Error("THREE.Interpolant: Call to abstract method.");
  }
  intervalChanged_() {}
}

class CubicInterpolant extends Interpolant {
  constructor(parameterPositions, sampleValues, sampleSize, resultBuffer) {
    super(parameterPositions, sampleValues, sampleSize, resultBuffer);
    this._weightPrev = -0;
    this._offsetPrev = -0;
    this._weightNext = -0;
    this._offsetNext = -0;
    this.DefaultSettings_ = {
      endingStart: ZeroCurvatureEnding,
      endingEnd: ZeroCurvatureEnding
    };
  }
  intervalChanged_(i1, t0, t1) {
    const pp = this.parameterPositions;
    let iPrev = i1 - 2, iNext = i1 + 1, tPrev = pp[iPrev], tNext = pp[iNext];
    if (tPrev === undefined) {
      switch (this.getSettings_().endingStart) {
        case ZeroSlopeEnding:
          iPrev = i1;
          tPrev = 2 * t0 - t1;
          break;
        case WrapAroundEnding:
          iPrev = pp.length - 2;
          tPrev = t0 + pp[iPrev] - pp[iPrev + 1];
          break;
        default:
          iPrev = i1;
          tPrev = t1;
      }
    }
    if (tNext === undefined) {
      switch (this.getSettings_().endingEnd) {
        case ZeroSlopeEnding:
          iNext = i1;
          tNext = 2 * t1 - t0;
          break;
        case WrapAroundEnding:
          iNext = 1;
          tNext = t1 + pp[1] - pp[0];
          break;
        default:
          iNext = i1 - 1;
          tNext = t0;
      }
    }
    const halfDt = (t1 - t0) * 0.5, stride = this.valueSize;
    this._weightPrev = halfDt / (t0 - tPrev);
    this._weightNext = halfDt / (tNext - t1);
    this._offsetPrev = iPrev * stride;
    this._offsetNext = iNext * stride;
  }
  interpolate_(i1, t0, t, t1) {
    const result = this.resultBuffer, values = this.sampleValues, stride = this.valueSize, o1 = i1 * stride, o0 = o1 - stride, oP = this._offsetPrev, oN = this._offsetNext, wP = this._weightPrev, wN = this._weightNext, p = (t - t0) / (t1 - t0), pp = p * p, ppp = pp * p;
    const sP = -wP * ppp + 2 * wP * pp - wP * p;
    const s0 = (1 + wP) * ppp + (-1.5 - 2 * wP) * pp + (-0.5 + wP) * p + 1;
    const s1 = (-1 - wN) * ppp + (1.5 + wN) * pp + 0.5 * p;
    const sN = wN * ppp - wN * pp;
    for (let i = 0;i !== stride; ++i) {
      result[i] = sP * values[oP + i] + s0 * values[o0 + i] + s1 * values[o1 + i] + sN * values[oN + i];
    }
    return result;
  }
}

class LinearInterpolant extends Interpolant {
  constructor(parameterPositions, sampleValues, sampleSize, resultBuffer) {
    super(parameterPositions, sampleValues, sampleSize, resultBuffer);
  }
  interpolate_(i1, t0, t, t1) {
    const result = this.resultBuffer, values = this.sampleValues, stride = this.valueSize, offset1 = i1 * stride, offset0 = offset1 - stride, weight1 = (t - t0) / (t1 - t0), weight0 = 1 - weight1;
    for (let i = 0;i !== stride; ++i) {
      result[i] = values[offset0 + i] * weight0 + values[offset1 + i] * weight1;
    }
    return result;
  }
}

class DiscreteInterpolant extends Interpolant {
  constructor(parameterPositions, sampleValues, sampleSize, resultBuffer) {
    super(parameterPositions, sampleValues, sampleSize, resultBuffer);
  }
  interpolate_(i1) {
    return this.copySampleValue_(i1 - 1);
  }
}

class BezierInterpolant extends Interpolant {
  interpolate_(i1, t0, t, t1) {
    const result = this.resultBuffer;
    const values = this.sampleValues;
    const stride = this.valueSize;
    const offset1 = i1 * stride;
    const offset0 = offset1 - stride;
    const inTangents = this.inTangents;
    const outTangents = this.outTangents;
    if (!inTangents || !outTangents) {
      const weight1 = (t - t0) / (t1 - t0);
      const weight0 = 1 - weight1;
      for (let i = 0;i !== stride; ++i) {
        result[i] = values[offset0 + i] * weight0 + values[offset1 + i] * weight1;
      }
      return result;
    }
    const tangentStride = stride * 2;
    const i0 = i1 - 1;
    for (let i = 0;i !== stride; ++i) {
      const v0 = values[offset0 + i];
      const v1 = values[offset1 + i];
      const outTangentOffset = i0 * tangentStride + i * 2;
      const c0x = outTangents[outTangentOffset];
      const c0y = outTangents[outTangentOffset + 1];
      const inTangentOffset = i1 * tangentStride + i * 2;
      const c1x = inTangents[inTangentOffset];
      const c1y = inTangents[inTangentOffset + 1];
      let s = (t - t0) / (t1 - t0);
      let s2, s3, oneMinusS, oneMinusS2, oneMinusS3;
      for (let iter = 0;iter < 8; iter++) {
        s2 = s * s;
        s3 = s2 * s;
        oneMinusS = 1 - s;
        oneMinusS2 = oneMinusS * oneMinusS;
        oneMinusS3 = oneMinusS2 * oneMinusS;
        const bx = oneMinusS3 * t0 + 3 * oneMinusS2 * s * c0x + 3 * oneMinusS * s2 * c1x + s3 * t1;
        const error2 = bx - t;
        if (Math.abs(error2) < 0.0000000001)
          break;
        const dbx = 3 * oneMinusS2 * (c0x - t0) + 6 * oneMinusS * s * (c1x - c0x) + 3 * s2 * (t1 - c1x);
        if (Math.abs(dbx) < 0.0000000001)
          break;
        s = s - error2 / dbx;
        s = Math.max(0, Math.min(1, s));
      }
      result[i] = oneMinusS3 * v0 + 3 * oneMinusS2 * s * c0y + 3 * oneMinusS * s2 * c1y + s3 * v1;
    }
    return result;
  }
}

class KeyframeTrack {
  constructor(name, times, values, interpolation) {
    if (name === undefined)
      throw new Error("THREE.KeyframeTrack: track name is undefined");
    if (times === undefined || times.length === 0)
      throw new Error("THREE.KeyframeTrack: no keyframes in track named " + name);
    this.name = name;
    this.times = convertArray(times, this.TimeBufferType);
    this.values = convertArray(values, this.ValueBufferType);
    this.setInterpolation(interpolation || this.DefaultInterpolation);
  }
  static toJSON(track) {
    const trackType = track.constructor;
    let json;
    if (trackType.toJSON !== this.toJSON) {
      json = trackType.toJSON(track);
    } else {
      json = {
        name: track.name,
        times: convertArray(track.times, Array),
        values: convertArray(track.values, Array)
      };
      const interpolation = track.getInterpolation();
      if (interpolation !== track.DefaultInterpolation) {
        json.interpolation = interpolation;
      }
    }
    json.type = track.ValueTypeName;
    return json;
  }
  InterpolantFactoryMethodDiscrete(result) {
    return new DiscreteInterpolant(this.times, this.values, this.getValueSize(), result);
  }
  InterpolantFactoryMethodLinear(result) {
    return new LinearInterpolant(this.times, this.values, this.getValueSize(), result);
  }
  InterpolantFactoryMethodSmooth(result) {
    return new CubicInterpolant(this.times, this.values, this.getValueSize(), result);
  }
  InterpolantFactoryMethodBezier(result) {
    const interpolant = new BezierInterpolant(this.times, this.values, this.getValueSize(), result);
    if (this.settings) {
      interpolant.inTangents = this.settings.inTangents;
      interpolant.outTangents = this.settings.outTangents;
    }
    return interpolant;
  }
  setInterpolation(interpolation) {
    let factoryMethod;
    switch (interpolation) {
      case InterpolateDiscrete:
        factoryMethod = this.InterpolantFactoryMethodDiscrete;
        break;
      case InterpolateLinear:
        factoryMethod = this.InterpolantFactoryMethodLinear;
        break;
      case InterpolateSmooth:
        factoryMethod = this.InterpolantFactoryMethodSmooth;
        break;
      case InterpolateBezier:
        factoryMethod = this.InterpolantFactoryMethodBezier;
        break;
    }
    if (factoryMethod === undefined) {
      const message = "unsupported interpolation for " + this.ValueTypeName + " keyframe track named " + this.name;
      if (this.createInterpolant === undefined) {
        if (interpolation !== this.DefaultInterpolation) {
          this.setInterpolation(this.DefaultInterpolation);
        } else {
          throw new Error(message);
        }
      }
      warn("KeyframeTrack:", message);
      return this;
    }
    this.createInterpolant = factoryMethod;
    return this;
  }
  getInterpolation() {
    switch (this.createInterpolant) {
      case this.InterpolantFactoryMethodDiscrete:
        return InterpolateDiscrete;
      case this.InterpolantFactoryMethodLinear:
        return InterpolateLinear;
      case this.InterpolantFactoryMethodSmooth:
        return InterpolateSmooth;
      case this.InterpolantFactoryMethodBezier:
        return InterpolateBezier;
    }
  }
  getValueSize() {
    return this.values.length / this.times.length;
  }
  shift(timeOffset) {
    if (timeOffset !== 0) {
      const times = this.times;
      for (let i = 0, n = times.length;i !== n; ++i) {
        times[i] += timeOffset;
      }
    }
    return this;
  }
  scale(timeScale) {
    if (timeScale !== 1) {
      const times = this.times;
      for (let i = 0, n = times.length;i !== n; ++i) {
        times[i] *= timeScale;
      }
    }
    return this;
  }
  trim(startTime, endTime) {
    const times = this.times, nKeys = times.length;
    let from = 0, to = nKeys - 1;
    while (from !== nKeys && times[from] < startTime) {
      ++from;
    }
    while (to !== -1 && times[to] > endTime) {
      --to;
    }
    ++to;
    if (from !== 0 || to !== nKeys) {
      if (from >= to) {
        to = Math.max(to, 1);
        from = to - 1;
      }
      const stride = this.getValueSize();
      this.times = times.slice(from, to);
      this.values = this.values.slice(from * stride, to * stride);
    }
    return this;
  }
  validate() {
    let valid = true;
    const valueSize = this.getValueSize();
    if (valueSize - Math.floor(valueSize) !== 0) {
      error("KeyframeTrack: Invalid value size in track.", this);
      valid = false;
    }
    const times = this.times, values = this.values, nKeys = times.length;
    if (nKeys === 0) {
      error("KeyframeTrack: Track is empty.", this);
      valid = false;
    }
    let prevTime = null;
    for (let i = 0;i !== nKeys; i++) {
      const currTime = times[i];
      if (typeof currTime === "number" && isNaN(currTime)) {
        error("KeyframeTrack: Time is not a valid number.", this, i, currTime);
        valid = false;
        break;
      }
      if (prevTime !== null && prevTime > currTime) {
        error("KeyframeTrack: Out of order keys.", this, i, currTime, prevTime);
        valid = false;
        break;
      }
      prevTime = currTime;
    }
    if (values !== undefined) {
      if (isTypedArray(values)) {
        for (let i = 0, n = values.length;i !== n; ++i) {
          const value = values[i];
          if (isNaN(value)) {
            error("KeyframeTrack: Value is not a valid number.", this, i, value);
            valid = false;
            break;
          }
        }
      }
    }
    return valid;
  }
  optimize() {
    const times = this.times.slice(), values = this.values.slice(), stride = this.getValueSize(), smoothInterpolation = this.getInterpolation() === InterpolateSmooth, lastIndex = times.length - 1;
    let writeIndex = 1;
    for (let i = 1;i < lastIndex; ++i) {
      let keep = false;
      const time = times[i];
      const timeNext = times[i + 1];
      if (time !== timeNext && (i !== 1 || time !== times[0])) {
        if (!smoothInterpolation) {
          const offset = i * stride, offsetP = offset - stride, offsetN = offset + stride;
          for (let j = 0;j !== stride; ++j) {
            const value = values[offset + j];
            if (value !== values[offsetP + j] || value !== values[offsetN + j]) {
              keep = true;
              break;
            }
          }
        } else {
          keep = true;
        }
      }
      if (keep) {
        if (i !== writeIndex) {
          times[writeIndex] = times[i];
          const readOffset = i * stride, writeOffset = writeIndex * stride;
          for (let j = 0;j !== stride; ++j) {
            values[writeOffset + j] = values[readOffset + j];
          }
        }
        ++writeIndex;
      }
    }
    if (lastIndex > 0) {
      times[writeIndex] = times[lastIndex];
      for (let readOffset = lastIndex * stride, writeOffset = writeIndex * stride, j = 0;j !== stride; ++j) {
        values[writeOffset + j] = values[readOffset + j];
      }
      ++writeIndex;
    }
    if (writeIndex !== times.length) {
      this.times = times.slice(0, writeIndex);
      this.values = values.slice(0, writeIndex * stride);
    } else {
      this.times = times;
      this.values = values;
    }
    return this;
  }
  clone() {
    const times = this.times.slice();
    const values = this.values.slice();
    const TypedKeyframeTrack = this.constructor;
    const track = new TypedKeyframeTrack(this.name, times, values);
    track.createInterpolant = this.createInterpolant;
    return track;
  }
}
KeyframeTrack.prototype.ValueTypeName = "";
KeyframeTrack.prototype.TimeBufferType = Float32Array;
KeyframeTrack.prototype.ValueBufferType = Float32Array;
KeyframeTrack.prototype.DefaultInterpolation = InterpolateLinear;

class BooleanKeyframeTrack extends KeyframeTrack {
  constructor(name, times, values) {
    super(name, times, values);
  }
}
BooleanKeyframeTrack.prototype.ValueTypeName = "bool";
BooleanKeyframeTrack.prototype.ValueBufferType = Array;
BooleanKeyframeTrack.prototype.DefaultInterpolation = InterpolateDiscrete;
BooleanKeyframeTrack.prototype.InterpolantFactoryMethodLinear = undefined;
BooleanKeyframeTrack.prototype.InterpolantFactoryMethodSmooth = undefined;

class ColorKeyframeTrack extends KeyframeTrack {
  constructor(name, times, values, interpolation) {
    super(name, times, values, interpolation);
  }
}
ColorKeyframeTrack.prototype.ValueTypeName = "color";

class NumberKeyframeTrack extends KeyframeTrack {
  constructor(name, times, values, interpolation) {
    super(name, times, values, interpolation);
  }
}
NumberKeyframeTrack.prototype.ValueTypeName = "number";

class QuaternionLinearInterpolant extends Interpolant {
  constructor(parameterPositions, sampleValues, sampleSize, resultBuffer) {
    super(parameterPositions, sampleValues, sampleSize, resultBuffer);
  }
  interpolate_(i1, t0, t, t1) {
    const result = this.resultBuffer, values = this.sampleValues, stride = this.valueSize, alpha = (t - t0) / (t1 - t0);
    let offset = i1 * stride;
    for (let end = offset + stride;offset !== end; offset += 4) {
      Quaternion.slerpFlat(result, 0, values, offset - stride, values, offset, alpha);
    }
    return result;
  }
}

class QuaternionKeyframeTrack extends KeyframeTrack {
  constructor(name, times, values, interpolation) {
    super(name, times, values, interpolation);
  }
  InterpolantFactoryMethodLinear(result) {
    return new QuaternionLinearInterpolant(this.times, this.values, this.getValueSize(), result);
  }
}
QuaternionKeyframeTrack.prototype.ValueTypeName = "quaternion";
QuaternionKeyframeTrack.prototype.InterpolantFactoryMethodSmooth = undefined;

class StringKeyframeTrack extends KeyframeTrack {
  constructor(name, times, values) {
    super(name, times, values);
  }
}
StringKeyframeTrack.prototype.ValueTypeName = "string";
StringKeyframeTrack.prototype.ValueBufferType = Array;
StringKeyframeTrack.prototype.DefaultInterpolation = InterpolateDiscrete;
StringKeyframeTrack.prototype.InterpolantFactoryMethodLinear = undefined;
StringKeyframeTrack.prototype.InterpolantFactoryMethodSmooth = undefined;

class VectorKeyframeTrack extends KeyframeTrack {
  constructor(name, times, values, interpolation) {
    super(name, times, values, interpolation);
  }
}
VectorKeyframeTrack.prototype.ValueTypeName = "vector";
class LoadingManager {
  constructor(onLoad, onProgress, onError) {
    const scope = this;
    let isLoading = false;
    let itemsLoaded = 0;
    let itemsTotal = 0;
    let urlModifier = undefined;
    const handlers = [];
    this.onStart = undefined;
    this.onLoad = onLoad;
    this.onProgress = onProgress;
    this.onError = onError;
    this._abortController = null;
    this.itemStart = function(url) {
      itemsTotal++;
      if (isLoading === false) {
        if (scope.onStart !== undefined) {
          scope.onStart(url, itemsLoaded, itemsTotal);
        }
      }
      isLoading = true;
    };
    this.itemEnd = function(url) {
      itemsLoaded++;
      if (scope.onProgress !== undefined) {
        scope.onProgress(url, itemsLoaded, itemsTotal);
      }
      if (itemsLoaded === itemsTotal) {
        isLoading = false;
        if (scope.onLoad !== undefined) {
          scope.onLoad();
        }
      }
    };
    this.itemError = function(url) {
      if (scope.onError !== undefined) {
        scope.onError(url);
      }
    };
    this.resolveURL = function(url) {
      url = url.normalize("NFC");
      if (urlModifier) {
        return urlModifier(url);
      }
      return url;
    };
    this.setURLModifier = function(transform) {
      urlModifier = transform;
      return this;
    };
    this.addHandler = function(regex, loader) {
      handlers.push(regex, loader);
      return this;
    };
    this.removeHandler = function(regex) {
      const index = handlers.indexOf(regex);
      if (index !== -1) {
        handlers.splice(index, 2);
      }
      return this;
    };
    this.getHandler = function(file) {
      for (let i = 0, l = handlers.length;i < l; i += 2) {
        const regex = handlers[i];
        const loader = handlers[i + 1];
        if (regex.global)
          regex.lastIndex = 0;
        if (regex.test(file)) {
          return loader;
        }
      }
      return null;
    };
    this.abort = function() {
      this.abortController.abort();
      this._abortController = null;
      return this;
    };
  }
  get abortController() {
    if (!this._abortController) {
      this._abortController = new AbortController;
    }
    return this._abortController;
  }
}
var DefaultLoadingManager = /* @__PURE__ */ new LoadingManager;

class Loader {
  constructor(manager) {
    this.manager = manager !== undefined ? manager : DefaultLoadingManager;
    this.crossOrigin = "anonymous";
    this.withCredentials = false;
    this.path = "";
    this.resourcePath = "";
    this.requestHeader = {};
    if (typeof __THREE_DEVTOOLS__ !== "undefined") {
      __THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe", { detail: this }));
    }
  }
  load() {}
  loadAsync(url, onProgress) {
    const scope = this;
    return new Promise(function(resolve, reject) {
      scope.load(url, resolve, onProgress, reject);
    });
  }
  parse() {}
  setCrossOrigin(crossOrigin) {
    this.crossOrigin = crossOrigin;
    return this;
  }
  setWithCredentials(value) {
    this.withCredentials = value;
    return this;
  }
  setPath(path) {
    this.path = path;
    return this;
  }
  setResourcePath(resourcePath) {
    this.resourcePath = resourcePath;
    return this;
  }
  setRequestHeader(requestHeader) {
    this.requestHeader = requestHeader;
    return this;
  }
  abort() {
    return this;
  }
}
Loader.DEFAULT_MATERIAL_NAME = "__DEFAULT";
var _loading = new WeakMap;
var _errorMap = new WeakMap;
var _RESERVED_CHARS_RE = "\\[\\]\\.:\\/";
var _reservedRe = new RegExp("[" + _RESERVED_CHARS_RE + "]", "g");
var _wordChar = "[^" + _RESERVED_CHARS_RE + "]";
var _wordCharOrDot = "[^" + _RESERVED_CHARS_RE.replace("\\.", "") + "]";
var _directoryRe = /* @__PURE__ */ /((?:WC+[\/:])*)/.source.replace("WC", _wordChar);
var _nodeRe = /* @__PURE__ */ /(WCOD+)?/.source.replace("WCOD", _wordCharOrDot);
var _objectRe = /* @__PURE__ */ /(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC", _wordChar);
var _propertyRe = /* @__PURE__ */ /\.(WC+)(?:\[(.+)\])?/.source.replace("WC", _wordChar);
var _trackRe = new RegExp("" + "^" + _directoryRe + _nodeRe + _objectRe + _propertyRe + "$");
var _supportedObjectNames = ["material", "materials", "bones", "map"];

class Composite {
  constructor(targetGroup, path, optionalParsedPath) {
    const parsedPath = optionalParsedPath || PropertyBinding.parseTrackName(path);
    this._targetGroup = targetGroup;
    this._bindings = targetGroup.subscribe_(path, parsedPath);
  }
  getValue(array, offset) {
    this.bind();
    const firstValidIndex = this._targetGroup.nCachedObjects_, binding = this._bindings[firstValidIndex];
    if (binding !== undefined)
      binding.getValue(array, offset);
  }
  setValue(array, offset) {
    const bindings = this._bindings;
    for (let i = this._targetGroup.nCachedObjects_, n = bindings.length;i !== n; ++i) {
      bindings[i].setValue(array, offset);
    }
  }
  bind() {
    const bindings = this._bindings;
    for (let i = this._targetGroup.nCachedObjects_, n = bindings.length;i !== n; ++i) {
      bindings[i].bind();
    }
  }
  unbind() {
    const bindings = this._bindings;
    for (let i = this._targetGroup.nCachedObjects_, n = bindings.length;i !== n; ++i) {
      bindings[i].unbind();
    }
  }
}

class PropertyBinding {
  constructor(rootNode, path, parsedPath) {
    this.path = path;
    this.parsedPath = parsedPath || PropertyBinding.parseTrackName(path);
    this.node = PropertyBinding.findNode(rootNode, this.parsedPath.nodeName);
    this.rootNode = rootNode;
    this.getValue = this._getValue_unbound;
    this.setValue = this._setValue_unbound;
  }
  static create(root, path, parsedPath) {
    if (!(root && root.isAnimationObjectGroup)) {
      return new PropertyBinding(root, path, parsedPath);
    } else {
      return new PropertyBinding.Composite(root, path, parsedPath);
    }
  }
  static sanitizeNodeName(name) {
    return name.replace(/\s/g, "_").replace(_reservedRe, "");
  }
  static parseTrackName(trackName) {
    const matches = _trackRe.exec(trackName);
    if (matches === null) {
      throw new Error("THREE.PropertyBinding: Cannot parse trackName: " + trackName);
    }
    const results = {
      nodeName: matches[2],
      objectName: matches[3],
      objectIndex: matches[4],
      propertyName: matches[5],
      propertyIndex: matches[6]
    };
    const lastDot = results.nodeName && results.nodeName.lastIndexOf(".");
    if (lastDot !== undefined && lastDot !== -1) {
      const objectName = results.nodeName.substring(lastDot + 1);
      if (_supportedObjectNames.indexOf(objectName) !== -1) {
        results.nodeName = results.nodeName.substring(0, lastDot);
        results.objectName = objectName;
      }
    }
    if (results.propertyName === null || results.propertyName.length === 0) {
      throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: " + trackName);
    }
    return results;
  }
  static findNode(root, nodeName) {
    if (nodeName === undefined || nodeName === "" || nodeName === "." || nodeName === -1 || nodeName === root.name || nodeName === root.uuid) {
      return root;
    }
    if (root.skeleton) {
      const bone = root.skeleton.getBoneByName(nodeName);
      if (bone !== undefined) {
        return bone;
      }
    }
    if (root.children) {
      const searchNodeSubtree = function(children) {
        for (let i = 0;i < children.length; i++) {
          const childNode = children[i];
          if (childNode.name === nodeName || childNode.uuid === nodeName) {
            return childNode;
          }
          const result = searchNodeSubtree(childNode.children);
          if (result)
            return result;
        }
        return null;
      };
      const subTreeNode = searchNodeSubtree(root.children);
      if (subTreeNode) {
        return subTreeNode;
      }
    }
    return null;
  }
  _getValue_unavailable() {}
  _setValue_unavailable() {}
  _getValue_direct(buffer, offset) {
    buffer[offset] = this.targetObject[this.propertyName];
  }
  _getValue_array(buffer, offset) {
    const source = this.resolvedProperty;
    for (let i = 0, n = source.length;i !== n; ++i) {
      buffer[offset++] = source[i];
    }
  }
  _getValue_arrayElement(buffer, offset) {
    buffer[offset] = this.resolvedProperty[this.propertyIndex];
  }
  _getValue_toArray(buffer, offset) {
    this.resolvedProperty.toArray(buffer, offset);
  }
  _setValue_direct(buffer, offset) {
    this.targetObject[this.propertyName] = buffer[offset];
  }
  _setValue_direct_setNeedsUpdate(buffer, offset) {
    this.targetObject[this.propertyName] = buffer[offset];
    this.targetObject.needsUpdate = true;
  }
  _setValue_direct_setMatrixWorldNeedsUpdate(buffer, offset) {
    this.targetObject[this.propertyName] = buffer[offset];
    this.targetObject.matrixWorldNeedsUpdate = true;
  }
  _setValue_array(buffer, offset) {
    const dest = this.resolvedProperty;
    for (let i = 0, n = dest.length;i !== n; ++i) {
      dest[i] = buffer[offset++];
    }
  }
  _setValue_array_setNeedsUpdate(buffer, offset) {
    const dest = this.resolvedProperty;
    for (let i = 0, n = dest.length;i !== n; ++i) {
      dest[i] = buffer[offset++];
    }
    this.targetObject.needsUpdate = true;
  }
  _setValue_array_setMatrixWorldNeedsUpdate(buffer, offset) {
    const dest = this.resolvedProperty;
    for (let i = 0, n = dest.length;i !== n; ++i) {
      dest[i] = buffer[offset++];
    }
    this.targetObject.matrixWorldNeedsUpdate = true;
  }
  _setValue_arrayElement(buffer, offset) {
    this.resolvedProperty[this.propertyIndex] = buffer[offset];
  }
  _setValue_arrayElement_setNeedsUpdate(buffer, offset) {
    this.resolvedProperty[this.propertyIndex] = buffer[offset];
    this.targetObject.needsUpdate = true;
  }
  _setValue_arrayElement_setMatrixWorldNeedsUpdate(buffer, offset) {
    this.resolvedProperty[this.propertyIndex] = buffer[offset];
    this.targetObject.matrixWorldNeedsUpdate = true;
  }
  _setValue_fromArray(buffer, offset) {
    this.resolvedProperty.fromArray(buffer, offset);
  }
  _setValue_fromArray_setNeedsUpdate(buffer, offset) {
    this.resolvedProperty.fromArray(buffer, offset);
    this.targetObject.needsUpdate = true;
  }
  _setValue_fromArray_setMatrixWorldNeedsUpdate(buffer, offset) {
    this.resolvedProperty.fromArray(buffer, offset);
    this.targetObject.matrixWorldNeedsUpdate = true;
  }
  _getValue_unbound(targetArray, offset) {
    this.bind();
    this.getValue(targetArray, offset);
  }
  _setValue_unbound(sourceArray, offset) {
    this.bind();
    this.setValue(sourceArray, offset);
  }
  bind() {
    let targetObject = this.node;
    const parsedPath = this.parsedPath;
    const objectName = parsedPath.objectName;
    const propertyName = parsedPath.propertyName;
    let propertyIndex = parsedPath.propertyIndex;
    if (!targetObject) {
      targetObject = PropertyBinding.findNode(this.rootNode, parsedPath.nodeName);
      this.node = targetObject;
    }
    this.getValue = this._getValue_unavailable;
    this.setValue = this._setValue_unavailable;
    if (!targetObject) {
      warn("PropertyBinding: No target node found for track: " + this.path + ".");
      return;
    }
    if (objectName) {
      let objectIndex = parsedPath.objectIndex;
      switch (objectName) {
        case "materials":
          if (!targetObject.material) {
            error("PropertyBinding: Can not bind to material as node does not have a material.", this);
            return;
          }
          if (!targetObject.material.materials) {
            error("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.", this);
            return;
          }
          targetObject = targetObject.material.materials;
          break;
        case "bones":
          if (!targetObject.skeleton) {
            error("PropertyBinding: Can not bind to bones as node does not have a skeleton.", this);
            return;
          }
          targetObject = targetObject.skeleton.bones;
          for (let i = 0;i < targetObject.length; i++) {
            if (targetObject[i].name === objectIndex) {
              objectIndex = i;
              break;
            }
          }
          break;
        case "map":
          if ("map" in targetObject) {
            targetObject = targetObject.map;
            break;
          }
          if (!targetObject.material) {
            error("PropertyBinding: Can not bind to material as node does not have a material.", this);
            return;
          }
          if (!targetObject.material.map) {
            error("PropertyBinding: Can not bind to material.map as node.material does not have a map.", this);
            return;
          }
          targetObject = targetObject.material.map;
          break;
        default:
          if (targetObject[objectName] === undefined) {
            error("PropertyBinding: Can not bind to objectName of node undefined.", this);
            return;
          }
          targetObject = targetObject[objectName];
      }
      if (objectIndex !== undefined) {
        if (targetObject[objectIndex] === undefined) {
          error("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.", this, targetObject);
          return;
        }
        targetObject = targetObject[objectIndex];
      }
    }
    const nodeProperty = targetObject[propertyName];
    if (nodeProperty === undefined) {
      const nodeName = parsedPath.nodeName;
      error("PropertyBinding: Trying to update property for track: " + nodeName + "." + propertyName + " but it wasn't found.", targetObject);
      return;
    }
    let versioning = this.Versioning.None;
    this.targetObject = targetObject;
    if (targetObject.isMaterial === true) {
      versioning = this.Versioning.NeedsUpdate;
    } else if (targetObject.isObject3D === true) {
      versioning = this.Versioning.MatrixWorldNeedsUpdate;
    }
    let bindingType = this.BindingType.Direct;
    if (propertyIndex !== undefined) {
      if (propertyName === "morphTargetInfluences") {
        if (!targetObject.geometry) {
          error("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.", this);
          return;
        }
        if (!targetObject.geometry.morphAttributes) {
          error("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.", this);
          return;
        }
        if (targetObject.morphTargetDictionary[propertyIndex] !== undefined) {
          propertyIndex = targetObject.morphTargetDictionary[propertyIndex];
        }
      }
      bindingType = this.BindingType.ArrayElement;
      this.resolvedProperty = nodeProperty;
      this.propertyIndex = propertyIndex;
    } else if (nodeProperty.fromArray !== undefined && nodeProperty.toArray !== undefined) {
      bindingType = this.BindingType.HasFromToArray;
      this.resolvedProperty = nodeProperty;
    } else if (Array.isArray(nodeProperty)) {
      bindingType = this.BindingType.EntireArray;
      this.resolvedProperty = nodeProperty;
    } else {
      this.propertyName = propertyName;
    }
    this.getValue = this.GetterByBindingType[bindingType];
    this.setValue = this.SetterByBindingTypeAndVersioning[bindingType][versioning];
  }
  unbind() {
    this.node = null;
    this.getValue = this._getValue_unbound;
    this.setValue = this._setValue_unbound;
  }
}
PropertyBinding.Composite = Composite;
PropertyBinding.prototype.BindingType = {
  Direct: 0,
  EntireArray: 1,
  ArrayElement: 2,
  HasFromToArray: 3
};
PropertyBinding.prototype.Versioning = {
  None: 0,
  NeedsUpdate: 1,
  MatrixWorldNeedsUpdate: 2
};
PropertyBinding.prototype.GetterByBindingType = [
  PropertyBinding.prototype._getValue_direct,
  PropertyBinding.prototype._getValue_array,
  PropertyBinding.prototype._getValue_arrayElement,
  PropertyBinding.prototype._getValue_toArray
];
PropertyBinding.prototype.SetterByBindingTypeAndVersioning = [
  [
    PropertyBinding.prototype._setValue_direct,
    PropertyBinding.prototype._setValue_direct_setNeedsUpdate,
    PropertyBinding.prototype._setValue_direct_setMatrixWorldNeedsUpdate
  ],
  [
    PropertyBinding.prototype._setValue_array,
    PropertyBinding.prototype._setValue_array_setNeedsUpdate,
    PropertyBinding.prototype._setValue_array_setMatrixWorldNeedsUpdate
  ],
  [
    PropertyBinding.prototype._setValue_arrayElement,
    PropertyBinding.prototype._setValue_arrayElement_setNeedsUpdate,
    PropertyBinding.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate
  ],
  [
    PropertyBinding.prototype._setValue_fromArray,
    PropertyBinding.prototype._setValue_fromArray_setNeedsUpdate,
    PropertyBinding.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate
  ]
];
var _controlInterpolantsResultBuffer = new Float32Array(1);
class Matrix2 {
  static {
    Matrix2.prototype.isMatrix2 = true;
  }
  constructor(n11, n12, n21, n22) {
    this.elements = [
      1,
      0,
      0,
      1
    ];
    if (n11 !== undefined) {
      this.set(n11, n12, n21, n22);
    }
  }
  identity() {
    this.set(1, 0, 0, 1);
    return this;
  }
  fromArray(array, offset = 0) {
    for (let i = 0;i < 4; i++) {
      this.elements[i] = array[i + offset];
    }
    return this;
  }
  set(n11, n12, n21, n22) {
    const te = this.elements;
    te[0] = n11;
    te[2] = n12;
    te[1] = n21;
    te[3] = n22;
    return this;
  }
}
if (typeof __THREE_DEVTOOLS__ !== "undefined") {
  __THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register", { detail: {
    revision: REVISION
  } }));
}
if (typeof window !== "undefined") {
  if (window.__THREE__) {
    warn("WARNING: Multiple instances of Three.js being imported.");
  } else {
    window.__THREE__ = REVISION;
  }
}

// node_modules/three/build/three.module.js
var alphahash_fragment = `#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`;
var alphahash_pars_fragment = `#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`;
var alphamap_fragment = `#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`;
var alphamap_pars_fragment = `#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`;
var alphatest_fragment = `#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`;
var alphatest_pars_fragment = `#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`;
var aomap_fragment = `#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`;
var aomap_pars_fragment = `#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`;
var batching_pars_vertex = `#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`;
var batching_vertex = `#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`;
var begin_vertex = `vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`;
var beginnormal_vertex = `vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`;
var bsdfs = `float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`;
var iridescence_fragment = `#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`;
var bumpmap_pars_fragment = `#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`;
var clipping_planes_fragment = `#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`;
var clipping_planes_pars_fragment = `#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`;
var clipping_planes_pars_vertex = `#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`;
var clipping_planes_vertex = `#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`;
var color_fragment = `#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`;
var color_pars_fragment = `#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`;
var color_pars_vertex = `#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`;
var color_vertex = `#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`;
var common = `#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`;
var cube_uv_reflection_fragment = `#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`;
var defaultnormal_vertex = `vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`;
var displacementmap_pars_vertex = `#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`;
var displacementmap_vertex = `#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`;
var emissivemap_fragment = `#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`;
var emissivemap_pars_fragment = `#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`;
var colorspace_fragment = "gl_FragColor = linearToOutputTexel( gl_FragColor );";
var colorspace_pars_fragment = `vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`;
var envmap_fragment = `#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`;
var envmap_common_pars_fragment = `#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`;
var envmap_pars_fragment = `#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`;
var envmap_pars_vertex = `#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`;
var envmap_vertex = `#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`;
var fog_vertex = `#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`;
var fog_pars_vertex = `#ifdef USE_FOG
	varying float vFogDepth;
#endif`;
var fog_fragment = `#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;
var fog_pars_fragment = `#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`;
var gradientmap_pars_fragment = `#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`;
var lightmap_pars_fragment = `#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`;
var lights_lambert_fragment = `LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`;
var lights_lambert_pars_fragment = `varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`;
var lights_pars_begin = `uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`;
var envmap_physical_pars_fragment = `#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`;
var lights_toon_fragment = `ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`;
var lights_toon_pars_fragment = `varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`;
var lights_phong_fragment = `BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`;
var lights_phong_pars_fragment = `varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`;
var lights_physical_fragment = `PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`;
var lights_physical_pars_fragment = `uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
		vec3 iridescenceFresnelDielectric;
		vec3 iridescenceFresnelMetallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
vec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;
	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;
	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;
	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;
	float Ess_V = dfgV.x + dfgV.y;
	float Ess_L = dfgL.x + dfgL.y;
	float Ems_V = 1.0 - Ess_V;
	float Ems_L = 1.0 - Ess_L;
	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;
	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );
	float compensationFactor = Ems_V * Ems_L;
	vec3 multiScatter = Fms * compensationFactor;
	return singleScatter + multiScatter;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`;
var lights_fragment_begin = `
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`;
var lights_fragment_maps = `#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`;
var lights_fragment_end = `#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`;
var lightprobes_pars_fragment = `#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`;
var logdepthbuf_fragment = `#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`;
var logdepthbuf_pars_fragment = `#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`;
var logdepthbuf_pars_vertex = `#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`;
var logdepthbuf_vertex = `#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`;
var map_fragment = `#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`;
var map_pars_fragment = `#ifdef USE_MAP
	uniform sampler2D map;
#endif`;
var map_particle_fragment = `#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`;
var map_particle_pars_fragment = `#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`;
var metalnessmap_fragment = `float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`;
var metalnessmap_pars_fragment = `#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`;
var morphinstance_vertex = `#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`;
var morphcolor_vertex = `#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`;
var morphnormal_vertex = `#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`;
var morphtarget_pars_vertex = `#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`;
var morphtarget_vertex = `#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`;
var normal_fragment_begin = `float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`;
var normal_fragment_maps = `#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`;
var normal_pars_fragment = `#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`;
var normal_pars_vertex = `#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`;
var normal_vertex = `#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`;
var normalmap_pars_fragment = `#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`;
var clearcoat_normal_fragment_begin = `#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`;
var clearcoat_normal_fragment_maps = `#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`;
var clearcoat_pars_fragment = `#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`;
var iridescence_pars_fragment = `#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`;
var opaque_fragment = `#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`;
var packing = `vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`;
var premultiplied_alpha_fragment = `#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`;
var project_vertex = `vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`;
var dithering_fragment = `#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`;
var dithering_pars_fragment = `#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`;
var roughnessmap_fragment = `float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`;
var roughnessmap_pars_fragment = `#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`;
var shadowmap_pars_fragment = `#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`;
var shadowmap_pars_vertex = `#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`;
var shadowmap_vertex = `#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`;
var shadowmask_pars_fragment = `float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`;
var skinbase_vertex = `#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`;
var skinning_pars_vertex = `#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`;
var skinning_vertex = `#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`;
var skinnormal_vertex = `#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`;
var specularmap_fragment = `float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`;
var specularmap_pars_fragment = `#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`;
var tonemapping_fragment = `#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`;
var tonemapping_pars_fragment = `#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`;
var transmission_fragment = `#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`;
var transmission_pars_fragment = `#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`;
var uv_pars_fragment = `#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`;
var uv_pars_vertex = `#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`;
var uv_vertex = `#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`;
var worldpos_vertex = `#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;
var vertex$h = `varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`;
var fragment$h = `uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`;
var vertex$g = `varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`;
var fragment$g = `#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`;
var vertex$f = `varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`;
var fragment$f = `uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`;
var vertex$e = `#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`;
var fragment$e = `#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`;
var vertex$d = `#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`;
var fragment$d = `#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`;
var vertex$c = `varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`;
var fragment$c = `uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`;
var vertex$b = `uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`;
var fragment$b = `uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`;
var vertex$a = `#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`;
var fragment$a = `uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`;
var vertex$9 = `#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`;
var fragment$9 = `#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`;
var vertex$8 = `#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`;
var fragment$8 = `#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`;
var vertex$7 = `#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`;
var fragment$7 = `#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`;
var vertex$6 = `#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`;
var fragment$6 = `#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`;
var vertex$5 = `#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`;
var fragment$5 = `#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`;
var vertex$4 = `#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`;
var fragment$4 = `#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`;
var vertex$3 = `uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`;
var fragment$3 = `uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`;
var vertex$2 = `#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`;
var fragment$2 = `uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`;
var vertex$1 = `uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`;
var fragment$1 = `uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`;
var ShaderChunk = {
  alphahash_fragment,
  alphahash_pars_fragment,
  alphamap_fragment,
  alphamap_pars_fragment,
  alphatest_fragment,
  alphatest_pars_fragment,
  aomap_fragment,
  aomap_pars_fragment,
  batching_pars_vertex,
  batching_vertex,
  begin_vertex,
  beginnormal_vertex,
  bsdfs,
  iridescence_fragment,
  bumpmap_pars_fragment,
  clipping_planes_fragment,
  clipping_planes_pars_fragment,
  clipping_planes_pars_vertex,
  clipping_planes_vertex,
  color_fragment,
  color_pars_fragment,
  color_pars_vertex,
  color_vertex,
  common,
  cube_uv_reflection_fragment,
  defaultnormal_vertex,
  displacementmap_pars_vertex,
  displacementmap_vertex,
  emissivemap_fragment,
  emissivemap_pars_fragment,
  colorspace_fragment,
  colorspace_pars_fragment,
  envmap_fragment,
  envmap_common_pars_fragment,
  envmap_pars_fragment,
  envmap_pars_vertex,
  envmap_physical_pars_fragment,
  envmap_vertex,
  fog_vertex,
  fog_pars_vertex,
  fog_fragment,
  fog_pars_fragment,
  gradientmap_pars_fragment,
  lightmap_pars_fragment,
  lights_lambert_fragment,
  lights_lambert_pars_fragment,
  lights_pars_begin,
  lights_toon_fragment,
  lights_toon_pars_fragment,
  lights_phong_fragment,
  lights_phong_pars_fragment,
  lights_physical_fragment,
  lights_physical_pars_fragment,
  lights_fragment_begin,
  lights_fragment_maps,
  lights_fragment_end,
  lightprobes_pars_fragment,
  logdepthbuf_fragment,
  logdepthbuf_pars_fragment,
  logdepthbuf_pars_vertex,
  logdepthbuf_vertex,
  map_fragment,
  map_pars_fragment,
  map_particle_fragment,
  map_particle_pars_fragment,
  metalnessmap_fragment,
  metalnessmap_pars_fragment,
  morphinstance_vertex,
  morphcolor_vertex,
  morphnormal_vertex,
  morphtarget_pars_vertex,
  morphtarget_vertex,
  normal_fragment_begin,
  normal_fragment_maps,
  normal_pars_fragment,
  normal_pars_vertex,
  normal_vertex,
  normalmap_pars_fragment,
  clearcoat_normal_fragment_begin,
  clearcoat_normal_fragment_maps,
  clearcoat_pars_fragment,
  iridescence_pars_fragment,
  opaque_fragment,
  packing,
  premultiplied_alpha_fragment,
  project_vertex,
  dithering_fragment,
  dithering_pars_fragment,
  roughnessmap_fragment,
  roughnessmap_pars_fragment,
  shadowmap_pars_fragment,
  shadowmap_pars_vertex,
  shadowmap_vertex,
  shadowmask_pars_fragment,
  skinbase_vertex,
  skinning_pars_vertex,
  skinning_vertex,
  skinnormal_vertex,
  specularmap_fragment,
  specularmap_pars_fragment,
  tonemapping_fragment,
  tonemapping_pars_fragment,
  transmission_fragment,
  transmission_pars_fragment,
  uv_pars_fragment,
  uv_pars_vertex,
  uv_vertex,
  worldpos_vertex,
  background_vert: vertex$h,
  background_frag: fragment$h,
  backgroundCube_vert: vertex$g,
  backgroundCube_frag: fragment$g,
  cube_vert: vertex$f,
  cube_frag: fragment$f,
  depth_vert: vertex$e,
  depth_frag: fragment$e,
  distance_vert: vertex$d,
  distance_frag: fragment$d,
  equirect_vert: vertex$c,
  equirect_frag: fragment$c,
  linedashed_vert: vertex$b,
  linedashed_frag: fragment$b,
  meshbasic_vert: vertex$a,
  meshbasic_frag: fragment$a,
  meshlambert_vert: vertex$9,
  meshlambert_frag: fragment$9,
  meshmatcap_vert: vertex$8,
  meshmatcap_frag: fragment$8,
  meshnormal_vert: vertex$7,
  meshnormal_frag: fragment$7,
  meshphong_vert: vertex$6,
  meshphong_frag: fragment$6,
  meshphysical_vert: vertex$5,
  meshphysical_frag: fragment$5,
  meshtoon_vert: vertex$4,
  meshtoon_frag: fragment$4,
  points_vert: vertex$3,
  points_frag: fragment$3,
  shadow_vert: vertex$2,
  shadow_frag: fragment$2,
  sprite_vert: vertex$1,
  sprite_frag: fragment$1
};
var UniformsLib = {
  common: {
    diffuse: { value: /* @__PURE__ */ new Color(16777215) },
    opacity: { value: 1 },
    map: { value: null },
    mapTransform: { value: /* @__PURE__ */ new Matrix3 },
    alphaMap: { value: null },
    alphaMapTransform: { value: /* @__PURE__ */ new Matrix3 },
    alphaTest: { value: 0 }
  },
  specularmap: {
    specularMap: { value: null },
    specularMapTransform: { value: /* @__PURE__ */ new Matrix3 }
  },
  envmap: {
    envMap: { value: null },
    envMapRotation: { value: /* @__PURE__ */ new Matrix3 },
    reflectivity: { value: 1 },
    ior: { value: 1.5 },
    refractionRatio: { value: 0.98 },
    dfgLUT: { value: null }
  },
  aomap: {
    aoMap: { value: null },
    aoMapIntensity: { value: 1 },
    aoMapTransform: { value: /* @__PURE__ */ new Matrix3 }
  },
  lightmap: {
    lightMap: { value: null },
    lightMapIntensity: { value: 1 },
    lightMapTransform: { value: /* @__PURE__ */ new Matrix3 }
  },
  bumpmap: {
    bumpMap: { value: null },
    bumpMapTransform: { value: /* @__PURE__ */ new Matrix3 },
    bumpScale: { value: 1 }
  },
  normalmap: {
    normalMap: { value: null },
    normalMapTransform: { value: /* @__PURE__ */ new Matrix3 },
    normalScale: { value: /* @__PURE__ */ new Vector2(1, 1) }
  },
  displacementmap: {
    displacementMap: { value: null },
    displacementMapTransform: { value: /* @__PURE__ */ new Matrix3 },
    displacementScale: { value: 1 },
    displacementBias: { value: 0 }
  },
  emissivemap: {
    emissiveMap: { value: null },
    emissiveMapTransform: { value: /* @__PURE__ */ new Matrix3 }
  },
  metalnessmap: {
    metalnessMap: { value: null },
    metalnessMapTransform: { value: /* @__PURE__ */ new Matrix3 }
  },
  roughnessmap: {
    roughnessMap: { value: null },
    roughnessMapTransform: { value: /* @__PURE__ */ new Matrix3 }
  },
  gradientmap: {
    gradientMap: { value: null }
  },
  fog: {
    fogDensity: { value: 0.00025 },
    fogNear: { value: 1 },
    fogFar: { value: 2000 },
    fogColor: { value: /* @__PURE__ */ new Color(16777215) }
  },
  lights: {
    ambientLightColor: { value: [] },
    lightProbe: { value: [] },
    directionalLights: { value: [], properties: {
      direction: {},
      color: {}
    } },
    directionalLightShadows: { value: [], properties: {
      shadowIntensity: 1,
      shadowBias: {},
      shadowNormalBias: {},
      shadowRadius: {},
      shadowMapSize: {}
    } },
    directionalShadowMatrix: { value: [] },
    spotLights: { value: [], properties: {
      color: {},
      position: {},
      direction: {},
      distance: {},
      coneCos: {},
      penumbraCos: {},
      decay: {}
    } },
    spotLightShadows: { value: [], properties: {
      shadowIntensity: 1,
      shadowBias: {},
      shadowNormalBias: {},
      shadowRadius: {},
      shadowMapSize: {}
    } },
    spotLightMap: { value: [] },
    spotLightMatrix: { value: [] },
    pointLights: { value: [], properties: {
      color: {},
      position: {},
      decay: {},
      distance: {}
    } },
    pointLightShadows: { value: [], properties: {
      shadowIntensity: 1,
      shadowBias: {},
      shadowNormalBias: {},
      shadowRadius: {},
      shadowMapSize: {},
      shadowCameraNear: {},
      shadowCameraFar: {}
    } },
    pointShadowMatrix: { value: [] },
    hemisphereLights: { value: [], properties: {
      direction: {},
      skyColor: {},
      groundColor: {}
    } },
    rectAreaLights: { value: [], properties: {
      color: {},
      position: {},
      width: {},
      height: {}
    } },
    ltc_1: { value: null },
    ltc_2: { value: null },
    probesSH: { value: null },
    probesMin: { value: /* @__PURE__ */ new Vector3 },
    probesMax: { value: /* @__PURE__ */ new Vector3 },
    probesResolution: { value: /* @__PURE__ */ new Vector3 }
  },
  points: {
    diffuse: { value: /* @__PURE__ */ new Color(16777215) },
    opacity: { value: 1 },
    size: { value: 1 },
    scale: { value: 1 },
    map: { value: null },
    alphaMap: { value: null },
    alphaMapTransform: { value: /* @__PURE__ */ new Matrix3 },
    alphaTest: { value: 0 },
    uvTransform: { value: /* @__PURE__ */ new Matrix3 }
  },
  sprite: {
    diffuse: { value: /* @__PURE__ */ new Color(16777215) },
    opacity: { value: 1 },
    center: { value: /* @__PURE__ */ new Vector2(0.5, 0.5) },
    rotation: { value: 0 },
    map: { value: null },
    mapTransform: { value: /* @__PURE__ */ new Matrix3 },
    alphaMap: { value: null },
    alphaMapTransform: { value: /* @__PURE__ */ new Matrix3 },
    alphaTest: { value: 0 }
  }
};
var ShaderLib = {
  basic: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.specularmap,
      UniformsLib.envmap,
      UniformsLib.aomap,
      UniformsLib.lightmap,
      UniformsLib.fog
    ]),
    vertexShader: ShaderChunk.meshbasic_vert,
    fragmentShader: ShaderChunk.meshbasic_frag
  },
  lambert: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.specularmap,
      UniformsLib.envmap,
      UniformsLib.aomap,
      UniformsLib.lightmap,
      UniformsLib.emissivemap,
      UniformsLib.bumpmap,
      UniformsLib.normalmap,
      UniformsLib.displacementmap,
      UniformsLib.fog,
      UniformsLib.lights,
      {
        emissive: { value: /* @__PURE__ */ new Color(0) },
        envMapIntensity: { value: 1 }
      }
    ]),
    vertexShader: ShaderChunk.meshlambert_vert,
    fragmentShader: ShaderChunk.meshlambert_frag
  },
  phong: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.specularmap,
      UniformsLib.envmap,
      UniformsLib.aomap,
      UniformsLib.lightmap,
      UniformsLib.emissivemap,
      UniformsLib.bumpmap,
      UniformsLib.normalmap,
      UniformsLib.displacementmap,
      UniformsLib.fog,
      UniformsLib.lights,
      {
        emissive: { value: /* @__PURE__ */ new Color(0) },
        specular: { value: /* @__PURE__ */ new Color(1118481) },
        shininess: { value: 30 },
        envMapIntensity: { value: 1 }
      }
    ]),
    vertexShader: ShaderChunk.meshphong_vert,
    fragmentShader: ShaderChunk.meshphong_frag
  },
  standard: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.envmap,
      UniformsLib.aomap,
      UniformsLib.lightmap,
      UniformsLib.emissivemap,
      UniformsLib.bumpmap,
      UniformsLib.normalmap,
      UniformsLib.displacementmap,
      UniformsLib.roughnessmap,
      UniformsLib.metalnessmap,
      UniformsLib.fog,
      UniformsLib.lights,
      {
        emissive: { value: /* @__PURE__ */ new Color(0) },
        roughness: { value: 1 },
        metalness: { value: 0 },
        envMapIntensity: { value: 1 }
      }
    ]),
    vertexShader: ShaderChunk.meshphysical_vert,
    fragmentShader: ShaderChunk.meshphysical_frag
  },
  toon: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.aomap,
      UniformsLib.lightmap,
      UniformsLib.emissivemap,
      UniformsLib.bumpmap,
      UniformsLib.normalmap,
      UniformsLib.displacementmap,
      UniformsLib.gradientmap,
      UniformsLib.fog,
      UniformsLib.lights,
      {
        emissive: { value: /* @__PURE__ */ new Color(0) }
      }
    ]),
    vertexShader: ShaderChunk.meshtoon_vert,
    fragmentShader: ShaderChunk.meshtoon_frag
  },
  matcap: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.bumpmap,
      UniformsLib.normalmap,
      UniformsLib.displacementmap,
      UniformsLib.fog,
      {
        matcap: { value: null }
      }
    ]),
    vertexShader: ShaderChunk.meshmatcap_vert,
    fragmentShader: ShaderChunk.meshmatcap_frag
  },
  points: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.points,
      UniformsLib.fog
    ]),
    vertexShader: ShaderChunk.points_vert,
    fragmentShader: ShaderChunk.points_frag
  },
  dashed: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.fog,
      {
        scale: { value: 1 },
        dashSize: { value: 1 },
        totalSize: { value: 2 }
      }
    ]),
    vertexShader: ShaderChunk.linedashed_vert,
    fragmentShader: ShaderChunk.linedashed_frag
  },
  depth: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.displacementmap
    ]),
    vertexShader: ShaderChunk.depth_vert,
    fragmentShader: ShaderChunk.depth_frag
  },
  normal: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.bumpmap,
      UniformsLib.normalmap,
      UniformsLib.displacementmap,
      {
        opacity: { value: 1 }
      }
    ]),
    vertexShader: ShaderChunk.meshnormal_vert,
    fragmentShader: ShaderChunk.meshnormal_frag
  },
  sprite: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.sprite,
      UniformsLib.fog
    ]),
    vertexShader: ShaderChunk.sprite_vert,
    fragmentShader: ShaderChunk.sprite_frag
  },
  background: {
    uniforms: {
      uvTransform: { value: /* @__PURE__ */ new Matrix3 },
      t2D: { value: null },
      backgroundIntensity: { value: 1 }
    },
    vertexShader: ShaderChunk.background_vert,
    fragmentShader: ShaderChunk.background_frag
  },
  backgroundCube: {
    uniforms: {
      envMap: { value: null },
      backgroundBlurriness: { value: 0 },
      backgroundIntensity: { value: 1 },
      backgroundRotation: { value: /* @__PURE__ */ new Matrix3 }
    },
    vertexShader: ShaderChunk.backgroundCube_vert,
    fragmentShader: ShaderChunk.backgroundCube_frag
  },
  cube: {
    uniforms: {
      tCube: { value: null },
      tFlip: { value: -1 },
      opacity: { value: 1 }
    },
    vertexShader: ShaderChunk.cube_vert,
    fragmentShader: ShaderChunk.cube_frag
  },
  equirect: {
    uniforms: {
      tEquirect: { value: null }
    },
    vertexShader: ShaderChunk.equirect_vert,
    fragmentShader: ShaderChunk.equirect_frag
  },
  distance: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.displacementmap,
      {
        referencePosition: { value: /* @__PURE__ */ new Vector3 },
        nearDistance: { value: 1 },
        farDistance: { value: 1000 }
      }
    ]),
    vertexShader: ShaderChunk.distance_vert,
    fragmentShader: ShaderChunk.distance_frag
  },
  shadow: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.lights,
      UniformsLib.fog,
      {
        color: { value: /* @__PURE__ */ new Color(0) },
        opacity: { value: 1 }
      }
    ]),
    vertexShader: ShaderChunk.shadow_vert,
    fragmentShader: ShaderChunk.shadow_frag
  }
};
ShaderLib.physical = {
  uniforms: /* @__PURE__ */ mergeUniforms([
    ShaderLib.standard.uniforms,
    {
      clearcoat: { value: 0 },
      clearcoatMap: { value: null },
      clearcoatMapTransform: { value: /* @__PURE__ */ new Matrix3 },
      clearcoatNormalMap: { value: null },
      clearcoatNormalMapTransform: { value: /* @__PURE__ */ new Matrix3 },
      clearcoatNormalScale: { value: /* @__PURE__ */ new Vector2(1, 1) },
      clearcoatRoughness: { value: 0 },
      clearcoatRoughnessMap: { value: null },
      clearcoatRoughnessMapTransform: { value: /* @__PURE__ */ new Matrix3 },
      dispersion: { value: 0 },
      iridescence: { value: 0 },
      iridescenceMap: { value: null },
      iridescenceMapTransform: { value: /* @__PURE__ */ new Matrix3 },
      iridescenceIOR: { value: 1.3 },
      iridescenceThicknessMinimum: { value: 100 },
      iridescenceThicknessMaximum: { value: 400 },
      iridescenceThicknessMap: { value: null },
      iridescenceThicknessMapTransform: { value: /* @__PURE__ */ new Matrix3 },
      sheen: { value: 0 },
      sheenColor: { value: /* @__PURE__ */ new Color(0) },
      sheenColorMap: { value: null },
      sheenColorMapTransform: { value: /* @__PURE__ */ new Matrix3 },
      sheenRoughness: { value: 1 },
      sheenRoughnessMap: { value: null },
      sheenRoughnessMapTransform: { value: /* @__PURE__ */ new Matrix3 },
      transmission: { value: 0 },
      transmissionMap: { value: null },
      transmissionMapTransform: { value: /* @__PURE__ */ new Matrix3 },
      transmissionSamplerSize: { value: /* @__PURE__ */ new Vector2 },
      transmissionSamplerMap: { value: null },
      thickness: { value: 0 },
      thicknessMap: { value: null },
      thicknessMapTransform: { value: /* @__PURE__ */ new Matrix3 },
      attenuationDistance: { value: 0 },
      attenuationColor: { value: /* @__PURE__ */ new Color(0) },
      specularColor: { value: /* @__PURE__ */ new Color(1, 1, 1) },
      specularColorMap: { value: null },
      specularColorMapTransform: { value: /* @__PURE__ */ new Matrix3 },
      specularIntensity: { value: 1 },
      specularIntensityMap: { value: null },
      specularIntensityMapTransform: { value: /* @__PURE__ */ new Matrix3 },
      anisotropyVector: { value: /* @__PURE__ */ new Vector2 },
      anisotropyMap: { value: null },
      anisotropyMapTransform: { value: /* @__PURE__ */ new Matrix3 }
    }
  ]),
  vertexShader: ShaderChunk.meshphysical_vert,
  fragmentShader: ShaderChunk.meshphysical_frag
};
var _m$1 = /* @__PURE__ */ new Matrix3;
_m$1.set(-1, 0, 0, 0, 1, 0, 0, 0, 1);
var toneMappingMap = {
  [LinearToneMapping]: "LINEAR_TONE_MAPPING",
  [ReinhardToneMapping]: "REINHARD_TONE_MAPPING",
  [CineonToneMapping]: "CINEON_TONE_MAPPING",
  [ACESFilmicToneMapping]: "ACES_FILMIC_TONE_MAPPING",
  [AgXToneMapping]: "AGX_TONE_MAPPING",
  [NeutralToneMapping]: "NEUTRAL_TONE_MAPPING",
  [CustomToneMapping]: "CUSTOM_TONE_MAPPING"
};
var mat4array = new Float32Array(16);
var mat3array = new Float32Array(9);
var mat2array = new Float32Array(4);
var toneMappingFunctions = {
  [LinearToneMapping]: "Linear",
  [ReinhardToneMapping]: "Reinhard",
  [CineonToneMapping]: "Cineon",
  [ACESFilmicToneMapping]: "ACESFilmic",
  [AgXToneMapping]: "AgX",
  [NeutralToneMapping]: "Neutral",
  [CustomToneMapping]: "Custom"
};
var shaderChunkMap = new Map;
var shadowMapTypeDefines = {
  [PCFShadowMap]: "SHADOWMAP_TYPE_PCF",
  [VSMShadowMap]: "SHADOWMAP_TYPE_VSM"
};
var envMapTypeDefines = {
  [CubeReflectionMapping]: "ENVMAP_TYPE_CUBE",
  [CubeRefractionMapping]: "ENVMAP_TYPE_CUBE",
  [CubeUVReflectionMapping]: "ENVMAP_TYPE_CUBE_UV"
};
var envMapModeDefines = {
  [CubeRefractionMapping]: "ENVMAP_MODE_REFRACTION"
};
var envMapBlendingDefines = {
  [MultiplyOperation]: "ENVMAP_BLENDING_MULTIPLY",
  [MixOperation]: "ENVMAP_BLENDING_MIX",
  [AddOperation]: "ENVMAP_BLENDING_ADD"
};
var _m = /* @__PURE__ */ new Matrix3;
_m.set(-1, 0, 0, 0, 1, 0, 0, 0, 1);
var DATA = new Uint16Array([
  12469,
  15057,
  12620,
  14925,
  13266,
  14620,
  13807,
  14376,
  14323,
  13990,
  14545,
  13625,
  14713,
  13328,
  14840,
  12882,
  14931,
  12528,
  14996,
  12233,
  15039,
  11829,
  15066,
  11525,
  15080,
  11295,
  15085,
  10976,
  15082,
  10705,
  15073,
  10495,
  13880,
  14564,
  13898,
  14542,
  13977,
  14430,
  14158,
  14124,
  14393,
  13732,
  14556,
  13410,
  14702,
  12996,
  14814,
  12596,
  14891,
  12291,
  14937,
  11834,
  14957,
  11489,
  14958,
  11194,
  14943,
  10803,
  14921,
  10506,
  14893,
  10278,
  14858,
  9960,
  14484,
  14039,
  14487,
  14025,
  14499,
  13941,
  14524,
  13740,
  14574,
  13468,
  14654,
  13106,
  14743,
  12678,
  14818,
  12344,
  14867,
  11893,
  14889,
  11509,
  14893,
  11180,
  14881,
  10751,
  14852,
  10428,
  14812,
  10128,
  14765,
  9754,
  14712,
  9466,
  14764,
  13480,
  14764,
  13475,
  14766,
  13440,
  14766,
  13347,
  14769,
  13070,
  14786,
  12713,
  14816,
  12387,
  14844,
  11957,
  14860,
  11549,
  14868,
  11215,
  14855,
  10751,
  14825,
  10403,
  14782,
  10044,
  14729,
  9651,
  14666,
  9352,
  14599,
  9029,
  14967,
  12835,
  14966,
  12831,
  14963,
  12804,
  14954,
  12723,
  14936,
  12564,
  14917,
  12347,
  14900,
  11958,
  14886,
  11569,
  14878,
  11247,
  14859,
  10765,
  14828,
  10401,
  14784,
  10011,
  14727,
  9600,
  14660,
  9289,
  14586,
  8893,
  14508,
  8533,
  15111,
  12234,
  15110,
  12234,
  15104,
  12216,
  15092,
  12156,
  15067,
  12010,
  15028,
  11776,
  14981,
  11500,
  14942,
  11205,
  14902,
  10752,
  14861,
  10393,
  14812,
  9991,
  14752,
  9570,
  14682,
  9252,
  14603,
  8808,
  14519,
  8445,
  14431,
  8145,
  15209,
  11449,
  15208,
  11451,
  15202,
  11451,
  15190,
  11438,
  15163,
  11384,
  15117,
  11274,
  15055,
  10979,
  14994,
  10648,
  14932,
  10343,
  14871,
  9936,
  14803,
  9532,
  14729,
  9218,
  14645,
  8742,
  14556,
  8381,
  14461,
  8020,
  14365,
  7603,
  15273,
  10603,
  15272,
  10607,
  15267,
  10619,
  15256,
  10631,
  15231,
  10614,
  15182,
  10535,
  15118,
  10389,
  15042,
  10167,
  14963,
  9787,
  14883,
  9447,
  14800,
  9115,
  14710,
  8665,
  14615,
  8318,
  14514,
  7911,
  14411,
  7507,
  14279,
  7198,
  15314,
  9675,
  15313,
  9683,
  15309,
  9712,
  15298,
  9759,
  15277,
  9797,
  15229,
  9773,
  15166,
  9668,
  15084,
  9487,
  14995,
  9274,
  14898,
  8910,
  14800,
  8539,
  14697,
  8234,
  14590,
  7790,
  14479,
  7409,
  14367,
  7067,
  14178,
  6621,
  15337,
  8619,
  15337,
  8631,
  15333,
  8677,
  15325,
  8769,
  15305,
  8871,
  15264,
  8940,
  15202,
  8909,
  15119,
  8775,
  15022,
  8565,
  14916,
  8328,
  14804,
  8009,
  14688,
  7614,
  14569,
  7287,
  14448,
  6888,
  14321,
  6483,
  14088,
  6171,
  15350,
  7402,
  15350,
  7419,
  15347,
  7480,
  15340,
  7613,
  15322,
  7804,
  15287,
  7973,
  15229,
  8057,
  15148,
  8012,
  15046,
  7846,
  14933,
  7611,
  14810,
  7357,
  14682,
  7069,
  14552,
  6656,
  14421,
  6316,
  14251,
  5948,
  14007,
  5528,
  15356,
  5942,
  15356,
  5977,
  15353,
  6119,
  15348,
  6294,
  15332,
  6551,
  15302,
  6824,
  15249,
  7044,
  15171,
  7122,
  15070,
  7050,
  14949,
  6861,
  14818,
  6611,
  14679,
  6349,
  14538,
  6067,
  14398,
  5651,
  14189,
  5311,
  13935,
  4958,
  15359,
  4123,
  15359,
  4153,
  15356,
  4296,
  15353,
  4646,
  15338,
  5160,
  15311,
  5508,
  15263,
  5829,
  15188,
  6042,
  15088,
  6094,
  14966,
  6001,
  14826,
  5796,
  14678,
  5543,
  14527,
  5287,
  14377,
  4985,
  14133,
  4586,
  13869,
  4257,
  15360,
  1563,
  15360,
  1642,
  15358,
  2076,
  15354,
  2636,
  15341,
  3350,
  15317,
  4019,
  15273,
  4429,
  15203,
  4732,
  15105,
  4911,
  14981,
  4932,
  14836,
  4818,
  14679,
  4621,
  14517,
  4386,
  14359,
  4156,
  14083,
  3795,
  13808,
  3437,
  15360,
  122,
  15360,
  137,
  15358,
  285,
  15355,
  636,
  15344,
  1274,
  15322,
  2177,
  15281,
  2765,
  15215,
  3223,
  15120,
  3451,
  14995,
  3569,
  14846,
  3567,
  14681,
  3466,
  14511,
  3305,
  14344,
  3121,
  14037,
  2800,
  13753,
  2467,
  15360,
  0,
  15360,
  1,
  15359,
  21,
  15355,
  89,
  15346,
  253,
  15325,
  479,
  15287,
  796,
  15225,
  1148,
  15133,
  1492,
  15008,
  1749,
  14856,
  1882,
  14685,
  1886,
  14506,
  1783,
  14324,
  1608,
  13996,
  1398,
  13702,
  1183
]);

// node_modules/three-text/dist/index.js
var __dirname = "/Users/davidrug/RealDealVault/ProjectLiminality/DreamTalk/core/node_modules/three-text/dist", __filename = "/Users/davidrug/RealDealVault/ProjectLiminality/DreamTalk/core/node_modules/three-text/dist/index.js";
/*!
 * @license
 * three-text v0.6.5
 * Copyright © 2025-2026 Jeremy Tribby, Countertype LLC
 * SPDX-License-Identifier: MIT
 */
var isLogEnabled = (() => {
  if (typeof window !== "undefined" && window.THREE_TEXT_LOG) {
    return true;
  }
  if (typeof globalThis !== "undefined" && globalThis.process?.env?.THREE_TEXT_LOG === "true") {
    return true;
  }
  return false;
})();

class Logger {
  warn(message, ...args) {
    console.warn(message, ...args);
  }
  error(message, ...args) {
    console.error(message, ...args);
  }
  log(message, ...args) {
    isLogEnabled && console.log(message, ...args);
  }
}
var logger = new Logger;

class PerformanceLogger {
  constructor() {
    this.metrics = [];
    this.activeTimers = new Map;
  }
  start(name, metadata) {
    if (!isLogEnabled)
      return;
    const startTime = performance.now();
    const timerKey = `${name}_${startTime}`;
    this.activeTimers.set(timerKey, startTime);
    this.metrics.push({
      name,
      startTime,
      metadata
    });
  }
  end(name) {
    if (!isLogEnabled)
      return null;
    const endTime = performance.now();
    let timerKey;
    let startTime;
    for (const [key, time] of Array.from(this.activeTimers.entries()).reverse()) {
      if (key.startsWith(`${name}_`)) {
        timerKey = key;
        startTime = time;
        break;
      }
    }
    if (startTime === undefined || !timerKey) {
      logger.warn(`Performance timer "${name}" was not started`);
      return null;
    }
    const duration = endTime - startTime;
    this.activeTimers.delete(timerKey);
    for (let i = this.metrics.length - 1;i >= 0; i--) {
      const metric = this.metrics[i];
      if (metric.name === name && metric.startTime === startTime && !metric.endTime) {
        metric.endTime = endTime;
        metric.duration = duration;
        break;
      }
    }
    console.log(`${name}: ${duration.toFixed(2)}ms`);
    return duration;
  }
  getSummary() {
    if (!isLogEnabled)
      return {};
    const summary = {};
    for (const metric of this.metrics) {
      if (!metric.duration)
        continue;
      const existing = summary[metric.name];
      if (existing) {
        existing.count++;
        existing.totalDuration += metric.duration;
        existing.avgDuration = existing.totalDuration / existing.count;
        existing.lastDuration = metric.duration;
      } else {
        summary[metric.name] = {
          count: 1,
          avgDuration: metric.duration,
          totalDuration: metric.duration,
          lastDuration: metric.duration
        };
      }
    }
    return summary;
  }
  printSummary() {
    if (!isLogEnabled)
      return;
    const summary = this.getSummary();
    console.table(summary);
    console.log("Operations:", Object.keys(summary).sort().join(", "));
  }
  printBaseline() {
    if (!isLogEnabled)
      return;
    const summary = this.getSummary();
    Object.entries(summary).forEach(([name, stats]) => {
      console.log(`BASELINE ${name}: ${stats.avgDuration.toFixed(2)}ms avg (${stats.count} calls)`);
    });
  }
  clear() {
    if (!isLogEnabled)
      return;
    this.metrics.length = 0;
    this.activeTimers.clear();
  }
  time(name, fn, metadata) {
    if (!isLogEnabled)
      return fn();
    this.start(name, metadata);
    try {
      return fn();
    } finally {
      this.end(name);
    }
  }
  async timeAsync(name, fn, metadata) {
    if (!isLogEnabled)
      return fn();
    this.start(name, metadata);
    try {
      return await fn();
    } finally {
      this.end(name);
    }
  }
}
var perfLogger = new PerformanceLogger;
var DEFAULT_TOLERANCE = 800;
var DEFAULT_PRETOLERANCE = 100;
var DEFAULT_EMERGENCY_STRETCH = 0;
var SPACE_STRETCH_RATIO = 0.5;
var SPACE_SHRINK_RATIO = 1 / 3;
var ItemType;
(function(ItemType2) {
  ItemType2[ItemType2["BOX"] = 0] = "BOX";
  ItemType2[ItemType2["GLUE"] = 1] = "GLUE";
  ItemType2[ItemType2["PENALTY"] = 2] = "PENALTY";
  ItemType2[ItemType2["DISCRETIONARY"] = 3] = "DISCRETIONARY";
})(ItemType || (ItemType = {}));
var FitnessClass;
(function(FitnessClass2) {
  FitnessClass2[FitnessClass2["VERY_LOOSE"] = 0] = "VERY_LOOSE";
  FitnessClass2[FitnessClass2["LOOSE"] = 1] = "LOOSE";
  FitnessClass2[FitnessClass2["DECENT"] = 2] = "DECENT";
  FitnessClass2[FitnessClass2["TIGHT"] = 3] = "TIGHT";
})(FitnessClass || (FitnessClass = {}));

class ActiveNodeList {
  constructor() {
    this.nodesByKey = new Map;
    this.activeList = [];
  }
  getKey(position, fitness) {
    return position << 2 | fitness;
  }
  insert(node) {
    const key = this.getKey(node.position, node.fitness);
    const existing = this.nodesByKey.get(key);
    if (existing) {
      if (node.totalDemerits < existing.totalDemerits) {
        existing.totalDemerits = node.totalDemerits;
        existing.previous = node.previous;
        existing.hyphenated = node.hyphenated;
        existing.line = node.line;
        existing.cumWidth = node.cumWidth;
        existing.cumStretch = node.cumStretch;
        existing.cumShrink = node.cumShrink;
        return true;
      }
      return false;
    }
    node.active = true;
    node.activeIndex = this.activeList.length;
    this.activeList.push(node);
    this.nodesByKey.set(key, node);
    return true;
  }
  deactivate(node) {
    if (!node.active)
      return;
    node.active = false;
    const idx = node.activeIndex;
    const lastIdx = this.activeList.length - 1;
    if (idx !== lastIdx) {
      const lastNode = this.activeList[lastIdx];
      this.activeList[idx] = lastNode;
      lastNode.activeIndex = idx;
    }
    this.activeList.pop();
  }
  getActive() {
    return this.activeList;
  }
  size() {
    return this.activeList.length;
  }
}
var DEFAULT_HYPHEN_PENALTY = 50;
var DEFAULT_EX_HYPHEN_PENALTY = 50;
var DEFAULT_DOUBLE_HYPHEN_DEMERITS = 1e4;
var DEFAULT_FINAL_HYPHEN_DEMERITS = 5000;
var DEFAULT_LINE_PENALTY = 10;
var DEFAULT_FITNESS_DIFF_DEMERITS = 1e4;
var DEFAULT_LEFT_HYPHEN_MIN = 2;
var DEFAULT_RIGHT_HYPHEN_MIN = 3;
var INF_BAD = 1e4;
var INFINITY_PENALTY = 1e4;
var EJECT_PENALTY = -1e4;
var EMERGENCY_STRETCH_INCREMENT = 0.1;

class LineBreak {
  static badness(t, s) {
    if (t === 0)
      return 0;
    if (s <= 0)
      return INF_BAD + 1;
    const r = Math.abs(t / s);
    if (r > 10)
      return INF_BAD + 1;
    return Math.min(Math.round(100 * r ** 3), INF_BAD);
  }
  static fitnessClass(ratio) {
    if (ratio < -0.5)
      return FitnessClass.TIGHT;
    if (ratio < 0.5)
      return FitnessClass.DECENT;
    if (ratio < 1)
      return FitnessClass.LOOSE;
    return FitnessClass.VERY_LOOSE;
  }
  static findHyphenationPoints(word, language = "en-us", availablePatterns, lefthyphenmin = DEFAULT_LEFT_HYPHEN_MIN, righthyphenmin = DEFAULT_RIGHT_HYPHEN_MIN) {
    let patternTrie;
    if (availablePatterns && availablePatterns[language]) {
      patternTrie = availablePatterns[language];
    } else {
      return [];
    }
    if (!patternTrie)
      return [];
    const lowerWord = word.toLowerCase();
    const paddedWord = `.${lowerWord}.`;
    const points = new Array(paddedWord.length).fill(0);
    for (let i = 0;i < paddedWord.length; i++) {
      let node = patternTrie;
      for (let j = i;j < paddedWord.length; j++) {
        const char = paddedWord[j];
        if (!node.children || !node.children[char])
          break;
        node = node.children[char];
        if (node.patterns) {
          for (let k = 0;k < node.patterns.length; k++) {
            const pos = i + k;
            if (pos < points.length) {
              points[pos] = Math.max(points[pos], node.patterns[k]);
            }
          }
        }
      }
    }
    const hyphenPoints = [];
    for (let i = 2;i < paddedWord.length - 2; i++) {
      if (points[i] % 2 === 1) {
        hyphenPoints.push(i - 1);
      }
    }
    return hyphenPoints.filter((pos) => pos >= lefthyphenmin && word.length - pos >= righthyphenmin);
  }
  static itemizeText(text, measureText, measureTextWidths, hyphenate = false, language = "en-us", availablePatterns, lefthyphenmin = DEFAULT_LEFT_HYPHEN_MIN, righthyphenmin = DEFAULT_RIGHT_HYPHEN_MIN, context, lineWidth) {
    const items = [];
    items.push(...this.itemizeParagraph(text, measureText, measureTextWidths, hyphenate, language, availablePatterns, lefthyphenmin, righthyphenmin, context, lineWidth));
    items.push({
      type: ItemType.GLUE,
      width: 0,
      stretch: 1e7,
      shrink: 0,
      text: "",
      originIndex: text.length
    });
    items.push({
      type: ItemType.PENALTY,
      width: 0,
      penalty: EJECT_PENALTY,
      text: "",
      originIndex: text.length
    });
    return items;
  }
  static isCJK(char) {
    const code = char.codePointAt(0);
    if (code === undefined)
      return false;
    return code >= 19968 && code <= 40959 || code >= 13312 && code <= 19903 || code >= 131072 && code <= 173791 || code >= 173824 && code <= 177983 || code >= 177984 && code <= 178207 || code >= 178208 && code <= 183983 || code >= 63744 && code <= 64255 || code >= 12352 && code <= 12447 || code >= 12448 && code <= 12543 || code >= 44032 && code <= 55215 || code >= 4352 && code <= 4607 || code >= 12592 && code <= 12687 || code >= 43360 && code <= 43391 || code >= 55216 && code <= 55295 || code >= 65440 && code <= 65500;
  }
  static isCJClosingPunctuation(char) {
    const code = char.charCodeAt(0);
    return code === 12289 || code === 12290 || code === 65292 || code === 65294 || code === 65306 || code === 65307 || code === 65281 || code === 65311 || code === 65289 || code === 12305 || code === 65373 || code === 12301 || code === 12303 || code === 12297 || code === 12299 || code === 12309 || code === 12311 || code === 12313 || code === 12315 || code === 12540 || code === 8212 || code === 8230 || code === 8229;
  }
  static isCJOpeningPunctuation(char) {
    const code = char.charCodeAt(0);
    return code === 65288 || code === 12304 || code === 65371 || code === 12300 || code === 12302 || code === 12296 || code === 12298 || code === 12308 || code === 12310 || code === 12312 || code === 12314;
  }
  static isCJPunctuation(char) {
    return this.isCJClosingPunctuation(char) || this.isCJOpeningPunctuation(char);
  }
  static itemizeCJKText(text, measureText, measureTextWidths, context, startOffset = 0, glueParams) {
    const items = [];
    const chars = Array.from(text);
    const widths = measureTextWidths ? measureTextWidths(text) : null;
    let textPosition = startOffset;
    let glueWidth, glueStretch, glueShrink;
    if (glueParams) {
      glueWidth = glueParams.width;
      glueStretch = glueParams.stretch;
      glueShrink = glueParams.shrink;
    } else {
      const baseCharWidth = measureText("字");
      glueWidth = 0;
      glueStretch = baseCharWidth * 0.04;
      glueShrink = baseCharWidth * 0.04;
    }
    for (let i = 0;i < chars.length; i++) {
      const char = chars[i];
      const nextChar = i < chars.length - 1 ? chars[i + 1] : null;
      if (/\s/.test(char)) {
        const width = widths ? widths[i] ?? measureText(char) : measureText(char);
        items.push({
          type: ItemType.GLUE,
          width,
          stretch: width * SPACE_STRETCH_RATIO,
          shrink: width * SPACE_SHRINK_RATIO,
          text: char,
          originIndex: textPosition
        });
        textPosition += char.length;
        continue;
      }
      items.push({
        type: ItemType.BOX,
        width: widths ? widths[i] ?? measureText(char) : measureText(char),
        text: char,
        originIndex: textPosition
      });
      textPosition += char.length;
      if (nextChar && !/\s/.test(nextChar)) {
        let canBreak = true;
        if (this.isCJClosingPunctuation(nextChar))
          canBreak = false;
        if (this.isCJOpeningPunctuation(char))
          canBreak = false;
        const isPunctPair = this.isCJPunctuation(char) && this.isCJPunctuation(nextChar);
        if (canBreak && !isPunctPair) {
          items.push({
            type: ItemType.GLUE,
            width: glueWidth,
            stretch: glueStretch,
            shrink: glueShrink,
            text: "",
            originIndex: textPosition
          });
        }
      }
    }
    return items;
  }
  static itemizeParagraph(text, measureText, measureTextWidths, hyphenate, language, availablePatterns, lefthyphenmin, righthyphenmin, context, lineWidth) {
    const items = [];
    const chars = Array.from(text);
    let cjkGlueParams;
    const getCjkGlueParams = () => {
      if (!cjkGlueParams) {
        const baseCharWidth = measureText("字");
        cjkGlueParams = {
          width: 0,
          stretch: baseCharWidth * 0.04,
          shrink: baseCharWidth * 0.04
        };
      }
      return cjkGlueParams;
    };
    let buffer = "";
    let bufferStart = 0;
    let bufferScript = null;
    let textPosition = 0;
    const flushBuffer = () => {
      if (buffer.length === 0)
        return;
      if (bufferScript === "cjk") {
        items.push(...this.itemizeCJKText(buffer, measureText, measureTextWidths, context, bufferStart, getCjkGlueParams()));
      } else {
        items.push(...this.itemizeWordBased(buffer, bufferStart, measureText, hyphenate, language, availablePatterns, lefthyphenmin, righthyphenmin, context, lineWidth));
      }
      buffer = "";
      bufferScript = null;
    };
    for (let i = 0;i < chars.length; i++) {
      const char = chars[i];
      const isCJKChar = this.isCJK(char);
      const currentScript = isCJKChar ? "cjk" : "word";
      if (bufferScript !== null && bufferScript !== currentScript) {
        flushBuffer();
        bufferStart = textPosition;
      }
      if (bufferScript === null) {
        bufferScript = currentScript;
        bufferStart = textPosition;
      }
      buffer += char;
      textPosition += char.length;
    }
    flushBuffer();
    return items;
  }
  static itemizeWordBased(text, startOffset, measureText, hyphenate, language, availablePatterns, lefthyphenmin, righthyphenmin, context, lineWidth) {
    const items = [];
    const tokens = text.match(/\S+|\s+/g) || [];
    let currentIndex = 0;
    for (const token of tokens) {
      const tokenStartIndex = startOffset + currentIndex;
      if (/\s+/.test(token)) {
        const width = measureText(token);
        items.push({
          type: ItemType.GLUE,
          width,
          stretch: width * SPACE_STRETCH_RATIO,
          shrink: width * SPACE_SHRINK_RATIO,
          text: token,
          originIndex: tokenStartIndex
        });
        currentIndex += token.length;
      } else {
        if (lineWidth && token.includes("-") && !token.includes("­")) {
          const tokenWidth = measureText(token);
          if (tokenWidth > lineWidth) {
            const chars = Array.from(token);
            for (let i = 0;i < chars.length; i++) {
              items.push({
                type: ItemType.BOX,
                width: measureText(chars[i]),
                text: chars[i],
                originIndex: tokenStartIndex + i
              });
              if (i < chars.length - 1) {
                items.push({
                  type: ItemType.PENALTY,
                  width: 0,
                  penalty: 5000,
                  originIndex: tokenStartIndex + i + 1
                });
              }
            }
            currentIndex += token.length;
            continue;
          }
        }
        const segments = token.split(/(-)/);
        let segmentIndex = tokenStartIndex;
        for (const segment of segments) {
          if (!segment)
            continue;
          if (segment === "-") {
            items.push({
              type: ItemType.DISCRETIONARY,
              width: measureText("-"),
              preBreak: "-",
              postBreak: "",
              noBreak: "-",
              preBreakWidth: measureText("-"),
              penalty: context?.exHyphenPenalty ?? DEFAULT_EX_HYPHEN_PENALTY,
              flagged: true,
              text: "-",
              originIndex: segmentIndex
            });
            segmentIndex += 1;
          } else if (segment.includes("­")) {
            const parts = segment.split("­");
            let runningIndex = 0;
            for (let k = 0;k < parts.length; k++) {
              const partText = parts[k];
              if (partText.length > 0) {
                items.push({
                  type: ItemType.BOX,
                  width: measureText(partText),
                  text: partText,
                  originIndex: segmentIndex + runningIndex
                });
                runningIndex += partText.length;
              }
              if (k < parts.length - 1) {
                items.push({
                  type: ItemType.DISCRETIONARY,
                  width: 0,
                  preBreak: "-",
                  postBreak: "",
                  noBreak: "",
                  preBreakWidth: measureText("-"),
                  penalty: context?.hyphenPenalty ?? DEFAULT_HYPHEN_PENALTY,
                  flagged: true,
                  text: "",
                  originIndex: segmentIndex + runningIndex
                });
                runningIndex += 1;
              }
            }
          } else if (hyphenate && segment.length >= lefthyphenmin + righthyphenmin && /^\p{L}+$/u.test(segment)) {
            const hyphenPoints = this.findHyphenationPoints(segment, language, availablePatterns, lefthyphenmin, righthyphenmin);
            if (hyphenPoints.length > 0) {
              let lastPoint = 0;
              for (const point of hyphenPoints) {
                const part = segment.substring(lastPoint, point);
                items.push({
                  type: ItemType.BOX,
                  width: measureText(part),
                  text: part,
                  originIndex: segmentIndex + lastPoint
                });
                items.push({
                  type: ItemType.DISCRETIONARY,
                  width: 0,
                  preBreak: "-",
                  postBreak: "",
                  noBreak: "",
                  preBreakWidth: measureText("-"),
                  penalty: context?.hyphenPenalty ?? DEFAULT_HYPHEN_PENALTY,
                  flagged: true,
                  text: "",
                  originIndex: segmentIndex + point
                });
                lastPoint = point;
              }
              items.push({
                type: ItemType.BOX,
                width: measureText(segment.substring(lastPoint)),
                text: segment.substring(lastPoint),
                originIndex: segmentIndex + lastPoint
              });
            } else {
              const wordWidth = measureText(segment);
              if (lineWidth && wordWidth > lineWidth) {
                const chars = Array.from(segment);
                for (let i = 0;i < chars.length; i++) {
                  items.push({
                    type: ItemType.BOX,
                    width: measureText(chars[i]),
                    text: chars[i],
                    originIndex: segmentIndex + i
                  });
                  if (i < chars.length - 1) {
                    items.push({
                      type: ItemType.PENALTY,
                      width: 0,
                      penalty: 5000,
                      originIndex: segmentIndex + i + 1
                    });
                  }
                }
              } else {
                items.push({
                  type: ItemType.BOX,
                  width: wordWidth,
                  text: segment,
                  originIndex: segmentIndex
                });
              }
            }
          } else {
            const wordWidth = measureText(segment);
            if (lineWidth && wordWidth > lineWidth) {
              const chars = Array.from(segment);
              for (let i = 0;i < chars.length; i++) {
                items.push({
                  type: ItemType.BOX,
                  width: measureText(chars[i]),
                  text: chars[i],
                  originIndex: segmentIndex + i
                });
                if (i < chars.length - 1) {
                  items.push({
                    type: ItemType.PENALTY,
                    width: 0,
                    penalty: 5000,
                    originIndex: segmentIndex + i + 1
                  });
                }
              }
            } else {
              items.push({
                type: ItemType.BOX,
                width: wordWidth,
                text: segment,
                originIndex: segmentIndex
              });
            }
          }
          segmentIndex += segment.length;
        }
        currentIndex += token.length;
      }
    }
    return items;
  }
  static lineBreak(items, lineWidth, threshold, emergencyStretch, context) {
    const activeNodes = new ActiveNodeList;
    activeNodes.insert({
      position: 0,
      line: 0,
      fitness: FitnessClass.DECENT,
      totalDemerits: 0,
      previous: null,
      hyphenated: false,
      active: true,
      activeIndex: 0,
      cumWidth: 0,
      cumStretch: 0,
      cumShrink: 0
    });
    let cumWidth = 0;
    let cumStretch = 0;
    let cumShrink = 0;
    for (let i = 0;i < items.length; i++) {
      const item = items[i];
      const isBreakpoint = item.type === ItemType.PENALTY && item.penalty < INFINITY_PENALTY || item.type === ItemType.DISCRETIONARY || item.type === ItemType.GLUE && i > 0 && items[i - 1].type === ItemType.BOX;
      if (!isBreakpoint) {
        if (item.type === ItemType.BOX) {
          cumWidth += item.width;
        } else if (item.type === ItemType.GLUE) {
          const glue = item;
          cumWidth += glue.width;
          cumStretch += glue.stretch;
          cumShrink += glue.shrink;
        } else if (item.type === ItemType.DISCRETIONARY) {
          cumWidth += item.width;
        }
        continue;
      }
      let pi = 0;
      let flagged = false;
      if (item.type === ItemType.PENALTY) {
        pi = item.penalty;
        flagged = item.flagged || false;
      } else if (item.type === ItemType.DISCRETIONARY) {
        pi = item.penalty;
        flagged = item.flagged || false;
      }
      let breakWidth = 0;
      if (item.type === ItemType.DISCRETIONARY) {
        breakWidth = item.preBreakWidth;
      }
      const bestNode = [null, null, null, null];
      const bestDemerits = [Infinity, Infinity, Infinity, Infinity];
      const toDeactivate = [];
      const active = activeNodes.getActive();
      for (let j = 0;j < active.length; j++) {
        const a = active[j];
        const lineW = cumWidth - a.cumWidth + breakWidth;
        const lineStretch = cumStretch - a.cumStretch;
        const lineShrink = cumShrink - a.cumShrink;
        const shortfall = lineWidth - lineW;
        let ratio;
        if (shortfall > 0) {
          const effectiveStretch = lineStretch + emergencyStretch;
          ratio = effectiveStretch > 0 ? shortfall / effectiveStretch : Infinity;
        } else if (shortfall < 0) {
          ratio = lineShrink > 0 ? shortfall / lineShrink : -Infinity;
        } else {
          ratio = 0;
        }
        const bad = this.badness(shortfall, shortfall > 0 ? lineStretch + emergencyStretch : lineShrink);
        if (ratio < -1) {
          toDeactivate.push(a);
          continue;
        }
        if (pi !== EJECT_PENALTY && bad > threshold) {
          continue;
        }
        let demerits = context.linePenalty + bad;
        if (Math.abs(demerits) >= 1e4) {
          demerits = 1e8;
        } else {
          demerits = demerits * demerits;
        }
        if (pi > 0) {
          demerits += pi * pi;
        } else if (pi > EJECT_PENALTY) {
          demerits -= pi * pi;
        }
        if (flagged && a.hyphenated) {
          demerits += context.doubleHyphenDemerits;
        }
        const fitness = this.fitnessClass(ratio);
        if (Math.abs(fitness - a.fitness) > 1) {
          demerits += context.adjDemerits;
        }
        const totalDemerits = a.totalDemerits + demerits;
        if (totalDemerits < bestDemerits[fitness]) {
          bestDemerits[fitness] = totalDemerits;
          bestNode[fitness] = {
            position: i,
            line: a.line + 1,
            fitness,
            totalDemerits,
            previous: a,
            hyphenated: flagged,
            active: true,
            activeIndex: -1,
            cumWidth,
            cumStretch,
            cumShrink
          };
        }
      }
      for (const node of toDeactivate) {
        activeNodes.deactivate(node);
      }
      for (let f = 0;f < 4; f++) {
        if (bestNode[f]) {
          activeNodes.insert(bestNode[f]);
        }
      }
      if (activeNodes.size() === 0 && pi !== EJECT_PENALTY) {
        return null;
      }
      if (item.type === ItemType.BOX) {
        cumWidth += item.width;
      } else if (item.type === ItemType.GLUE) {
        const glue = item;
        cumWidth += glue.width;
        cumStretch += glue.stretch;
        cumShrink += glue.shrink;
      } else if (item.type === ItemType.DISCRETIONARY) {
        cumWidth += item.width;
      }
    }
    let best = null;
    let bestTotal = Infinity;
    for (const node of activeNodes.getActive()) {
      if (node.totalDemerits < bestTotal) {
        bestTotal = node.totalDemerits;
        best = node;
      }
    }
    return best;
  }
  static breakText(options) {
    if (!options.text || options.text.length === 0) {
      return [];
    }
    perfLogger.start("LineBreak.breakText", {
      textLength: options.text.length,
      width: options.width,
      align: options.align || "left",
      hyphenate: options.hyphenate || false
    });
    const { text, width, align = "left", direction = "ltr", hyphenate = false, language = "en-us", respectExistingBreaks = true, measureText, measureTextWidths, hyphenationPatterns, unitsPerEm, letterSpacing = 0, tolerance = DEFAULT_TOLERANCE, pretolerance = DEFAULT_PRETOLERANCE, emergencyStretch = DEFAULT_EMERGENCY_STRETCH, autoEmergencyStretch, lefthyphenmin = DEFAULT_LEFT_HYPHEN_MIN, righthyphenmin = DEFAULT_RIGHT_HYPHEN_MIN, linepenalty = DEFAULT_LINE_PENALTY, adjdemerits = DEFAULT_FITNESS_DIFF_DEMERITS, hyphenpenalty = DEFAULT_HYPHEN_PENALTY, exhyphenpenalty = DEFAULT_EX_HYPHEN_PENALTY, doublehyphendemerits = DEFAULT_DOUBLE_HYPHEN_DEMERITS, finalhyphendemerits = DEFAULT_FINAL_HYPHEN_DEMERITS } = options;
    if (respectExistingBreaks && text.includes(`
`)) {
      const paragraphs = text.split(`
`);
      const allLines = [];
      let currentOriginOffset = 0;
      for (const paragraph of paragraphs) {
        if (paragraph.length === 0) {
          allLines.push({
            text: "",
            originalStart: currentOriginOffset,
            originalEnd: currentOriginOffset,
            xOffset: 0,
            isLastLine: true,
            naturalWidth: 0,
            endedWithHyphen: false
          });
        } else {
          const paragraphLines = this.breakText({
            ...options,
            text: paragraph,
            respectExistingBreaks: false
          });
          paragraphLines.forEach((line) => {
            line.originalStart += currentOriginOffset;
            line.originalEnd += currentOriginOffset;
          });
          allLines.push(...paragraphLines);
        }
        currentOriginOffset += paragraph.length + 1;
      }
      perfLogger.end("LineBreak.breakText");
      return allLines;
    }
    let useHyphenation = hyphenate;
    if (useHyphenation && (!hyphenationPatterns || !hyphenationPatterns[language])) {
      logger.warn(`Hyphenation patterns for ${language} not available`);
      useHyphenation = false;
    }
    let initialEmergencyStretch = emergencyStretch;
    if (autoEmergencyStretch !== undefined && width) {
      initialEmergencyStretch = width * autoEmergencyStretch;
    }
    const context = {
      linePenalty: linepenalty,
      adjDemerits: adjdemerits,
      doubleHyphenDemerits: doublehyphendemerits,
      finalHyphenDemerits: finalhyphendemerits,
      hyphenPenalty: hyphenpenalty,
      exHyphenPenalty: exhyphenpenalty,
      currentAlign: align,
      unitsPerEm,
      letterSpacingFU: unitsPerEm ? letterSpacing * unitsPerEm : 0
    };
    if (!width || width === Infinity) {
      const measuredWidth = measureText(text);
      perfLogger.end("LineBreak.breakText");
      return [
        {
          text,
          originalStart: 0,
          originalEnd: text.length - 1,
          xOffset: 0,
          isLastLine: true,
          naturalWidth: measuredWidth,
          endedWithHyphen: false
        }
      ];
    }
    let items = this.itemizeText(text, measureText, measureTextWidths, false, language, hyphenationPatterns, lefthyphenmin, righthyphenmin, context, width);
    let best = this.lineBreak(items, width, pretolerance, 0, context);
    if (!best && useHyphenation) {
      items = this.itemizeText(text, measureText, measureTextWidths, true, language, hyphenationPatterns, lefthyphenmin, righthyphenmin, context, width);
      best = this.lineBreak(items, width, tolerance, 0, context);
    }
    if (!best) {
      const MAX_EMERGENCY_ITERATIONS = 5;
      for (let i = 0;i < MAX_EMERGENCY_ITERATIONS && !best; i++) {
        const currentStretch = initialEmergencyStretch + i * width * EMERGENCY_STRETCH_INCREMENT;
        best = this.lineBreak(items, width, tolerance, currentStretch, context);
        if (!best) {
          best = this.lineBreak(items, width, INF_BAD, currentStretch, context);
        }
      }
    }
    if (best) {
      const breakpoints = [];
      let node = best;
      while (node && node.position > 0) {
        breakpoints.unshift(node.position);
        node = node.previous;
      }
      perfLogger.end("LineBreak.breakText");
      return this.postLineBreak(text, items, breakpoints, width, align, direction, context);
    }
    perfLogger.end("LineBreak.breakText");
    return [
      {
        text,
        originalStart: 0,
        originalEnd: text.length - 1,
        xOffset: 0,
        adjustmentRatio: 0,
        isLastLine: true,
        naturalWidth: measureText(text),
        endedWithHyphen: false
      }
    ];
  }
  static postLineBreak(text, items, breakpoints, lineWidth, align, direction, context) {
    if (breakpoints.length === 0) {
      return [
        {
          text,
          originalStart: 0,
          originalEnd: text.length - 1,
          xOffset: 0
        }
      ];
    }
    const lines = [];
    let lineStart = 0;
    for (let i = 0;i < breakpoints.length; i++) {
      const breakpoint = breakpoints[i];
      const willHaveFinalLine = breakpoints[breakpoints.length - 1] + 1 < items.length - 1;
      const isLastLine = willHaveFinalLine ? false : i === breakpoints.length - 1;
      const lineTextParts = [];
      let originalStart = -1;
      let originalEnd = -1;
      let naturalWidth = 0;
      let totalStretch = 0;
      let totalShrink = 0;
      for (let j = lineStart;j < breakpoint; j++) {
        const item = items[j];
        if (item.type === ItemType.PENALTY && !item.text || item.type === ItemType.DISCRETIONARY && !item.noBreak) {
          continue;
        }
        if (item.originIndex !== undefined) {
          if (originalStart === -1 || item.originIndex < originalStart)
            originalStart = item.originIndex;
          const textLength = item.text ? item.text.length : 0;
          const itemEnd = item.originIndex + textLength - 1;
          if (itemEnd > originalEnd)
            originalEnd = itemEnd;
        }
        if (item.text) {
          lineTextParts.push(item.text);
        } else if (item.type === ItemType.DISCRETIONARY) {
          const disc = item;
          if (disc.noBreak)
            lineTextParts.push(disc.noBreak);
        }
        naturalWidth += item.width;
        if (item.type === ItemType.GLUE) {
          totalStretch += item.stretch;
          totalShrink += item.shrink;
        }
      }
      const breakItem = items[breakpoint];
      let endedWithHyphen = false;
      if (breakpoint < items.length) {
        if (breakItem.type === ItemType.PENALTY && breakItem.flagged) {
          lineTextParts.push("-");
          naturalWidth += breakItem.width;
          endedWithHyphen = true;
          if (breakItem.originIndex !== undefined)
            originalEnd = breakItem.originIndex - 1;
        } else if (breakItem.type === ItemType.DISCRETIONARY) {
          const disc = breakItem;
          if (disc.preBreak) {
            lineTextParts.push(disc.preBreak);
            naturalWidth += disc.preBreakWidth;
            endedWithHyphen = disc.flagged || false;
            if (breakItem.originIndex !== undefined)
              originalEnd = breakItem.originIndex - 1;
          }
        }
      }
      const lineText = lineTextParts.join("");
      if (context?.letterSpacingFU && naturalWidth !== 0) {
        naturalWidth -= context.letterSpacingFU;
      }
      let xOffset = 0;
      let adjustmentRatio = 0;
      let effectiveAlign = align;
      if (align === "justify" && isLastLine) {
        effectiveAlign = direction === "rtl" ? "right" : "left";
      }
      if (effectiveAlign === "center") {
        xOffset = (lineWidth - naturalWidth) / 2;
      } else if (effectiveAlign === "right") {
        xOffset = lineWidth - naturalWidth;
      } else if (effectiveAlign === "justify" && !isLastLine) {
        const shortfall = lineWidth - naturalWidth;
        if (shortfall > 0 && totalStretch > 0) {
          adjustmentRatio = shortfall / totalStretch;
        } else if (shortfall < 0 && totalShrink > 0) {
          adjustmentRatio = shortfall / totalShrink;
        }
      }
      lines.push({
        text: lineText,
        originalStart,
        originalEnd,
        xOffset,
        adjustmentRatio,
        isLastLine: false,
        naturalWidth,
        endedWithHyphen
      });
      lineStart = breakpoint + 1;
    }
    if (lineStart < items.length - 1) {
      const finalLineTextParts = [];
      let finalOriginalStart = -1;
      let finalOriginalEnd = -1;
      let finalNaturalWidth = 0;
      for (let j = lineStart;j < items.length - 1; j++) {
        const item = items[j];
        if (item.type === ItemType.PENALTY)
          continue;
        if (item.originIndex !== undefined) {
          if (finalOriginalStart === -1 || item.originIndex < finalOriginalStart) {
            finalOriginalStart = item.originIndex;
          }
          if (item.originIndex > finalOriginalEnd) {
            finalOriginalEnd = item.originIndex;
          }
        }
        if (item.text)
          finalLineTextParts.push(item.text);
        finalNaturalWidth += item.width;
      }
      if (context?.letterSpacingFU && finalNaturalWidth !== 0) {
        finalNaturalWidth -= context.letterSpacingFU;
      }
      let finalXOffset = 0;
      let finalEffectiveAlign = align;
      if (align === "justify") {
        finalEffectiveAlign = direction === "rtl" ? "right" : "left";
      }
      if (finalEffectiveAlign === "center") {
        finalXOffset = (lineWidth - finalNaturalWidth) / 2;
      } else if (finalEffectiveAlign === "right") {
        finalXOffset = lineWidth - finalNaturalWidth;
      }
      lines.push({
        text: finalLineTextParts.join(""),
        originalStart: finalOriginalStart,
        originalEnd: finalOriginalEnd,
        xOffset: finalXOffset,
        adjustmentRatio: 0,
        isLastLine: true,
        naturalWidth: finalNaturalWidth,
        endedWithHyphen: false
      });
      if (lines.length > 1)
        lines[lines.length - 2].isLastLine = false;
      lines[lines.length - 1].isLastLine = true;
    } else if (lines.length > 0) {
      lines[lines.length - 1].isLastLine = true;
    }
    return lines;
  }
}
var featureStringCache = new WeakMap;
function convertFontFeaturesToString(features) {
  if (!features || Object.keys(features).length === 0) {
    return;
  }
  const cached = featureStringCache.get(features);
  if (cached !== undefined) {
    return cached ?? undefined;
  }
  const featureStrings = [];
  for (const [tag, value] of Object.entries(features)) {
    if (!/^[a-zA-Z0-9]{4}$/.test(tag)) {
      logger.warn(`Invalid OpenType feature tag: "${tag}". Tags must be exactly 4 alphanumeric characters.`);
      continue;
    }
    if (value === false || value === 0) {
      featureStrings.push(`${tag}=0`);
    } else if (value === true || value === 1) {
      featureStrings.push(tag);
    } else if (typeof value === "number" && value > 1) {
      featureStrings.push(`${tag}=${Math.floor(value)}`);
    } else {
      logger.warn(`Invalid value for feature "${tag}": ${value}. Expected boolean or positive number.`);
    }
  }
  const result = featureStrings.length > 0 ? featureStrings.join(",") : undefined;
  featureStringCache.set(features, result ?? null);
  return result;
}

class TextMeasurer {
  static measureTextWidths(loadedFont, text, letterSpacing = 0) {
    const chars = Array.from(text);
    if (chars.length === 0)
      return [];
    const startToCharIndex = new Map;
    let codeUnitIndex = 0;
    for (let i = 0;i < chars.length; i++) {
      startToCharIndex.set(codeUnitIndex, i);
      codeUnitIndex += chars[i].length;
    }
    const widths = new Array(chars.length).fill(0);
    const buffer = loadedFont.hb.createBuffer();
    try {
      buffer.addText(text);
      buffer.guessSegmentProperties();
      const featuresString = convertFontFeaturesToString(loadedFont.fontFeatures);
      loadedFont.hb.shape(loadedFont.font, buffer, featuresString);
      const glyphInfos = buffer.json(loadedFont.font);
      const letterSpacingInFontUnits = letterSpacing * loadedFont.upem;
      for (let i = 0;i < glyphInfos.length; i++) {
        const glyph = glyphInfos[i];
        const cl = glyph.cl ?? 0;
        let charIndex = startToCharIndex.get(cl);
        if (charIndex === undefined) {
          for (let back = cl;back >= 0; back--) {
            const candidate = startToCharIndex.get(back);
            if (candidate !== undefined) {
              charIndex = candidate;
              break;
            }
          }
        }
        if (charIndex === undefined)
          continue;
        widths[charIndex] += glyph.ax;
        if (letterSpacingInFontUnits !== 0) {
          widths[charIndex] += letterSpacingInFontUnits;
        }
      }
      return widths;
    } finally {
      buffer.destroy();
    }
  }
  static measureTextWidth(loadedFont, text, letterSpacing = 0) {
    const buffer = loadedFont.hb.createBuffer();
    try {
      buffer.addText(text);
      buffer.guessSegmentProperties();
      const featuresString = convertFontFeaturesToString(loadedFont.fontFeatures);
      loadedFont.hb.shape(loadedFont.font, buffer, featuresString);
      const glyphInfos = buffer.json(loadedFont.font);
      const letterSpacingInFontUnits = letterSpacing * loadedFont.upem;
      let totalWidth = 0;
      for (let i = 0;i < glyphInfos.length; i++) {
        totalWidth += glyphInfos[i].ax;
        if (letterSpacingInFontUnits !== 0) {
          totalWidth += letterSpacingInFontUnits;
        }
      }
      return totalWidth;
    } finally {
      buffer.destroy();
    }
  }
}

class TextLayout {
  constructor(loadedFont) {
    this.loadedFont = loadedFont;
  }
  computeLines(options) {
    const { text, width, align, direction, hyphenate, language, respectExistingBreaks, tolerance, pretolerance, emergencyStretch, autoEmergencyStretch, hyphenationPatterns, lefthyphenmin, righthyphenmin, linepenalty, adjdemerits, hyphenpenalty, exhyphenpenalty, doublehyphendemerits, letterSpacing } = options;
    let lines;
    if (width) {
      const widthMemo = new Map;
      lines = LineBreak.breakText({
        text,
        width,
        align,
        direction,
        hyphenate,
        language,
        respectExistingBreaks,
        tolerance,
        pretolerance,
        emergencyStretch,
        autoEmergencyStretch,
        hyphenationPatterns,
        lefthyphenmin,
        righthyphenmin,
        linepenalty,
        adjdemerits,
        hyphenpenalty,
        exhyphenpenalty,
        doublehyphendemerits,
        unitsPerEm: this.loadedFont.upem,
        letterSpacing,
        measureText: (textToMeasure) => {
          let measured = widthMemo.get(textToMeasure);
          if (measured === undefined) {
            measured = TextMeasurer.measureTextWidth(this.loadedFont, textToMeasure, letterSpacing);
            widthMemo.set(textToMeasure, measured);
          }
          return measured;
        },
        measureTextWidths: (textToMeasure) => TextMeasurer.measureTextWidths(this.loadedFont, textToMeasure, letterSpacing)
      });
    } else {
      const linesArray = text.split(`
`);
      lines = [];
      let currentIndex = 0;
      for (const line of linesArray) {
        const originalEnd = line.length === 0 ? currentIndex : currentIndex + line.length - 1;
        lines.push({
          text: line,
          originalStart: currentIndex,
          originalEnd,
          xOffset: 0
        });
        currentIndex += line.length + 1;
      }
    }
    return { lines };
  }
  applyAlignment(vertices, options) {
    const { offset, adjustedBounds } = this.computeAlignmentOffset(options);
    if (offset !== 0) {
      for (let i = 0;i < vertices.length; i += 3) {
        vertices[i] += offset;
      }
    }
    return { offset, adjustedBounds };
  }
  computeAlignmentOffset(options) {
    const { width, align, planeBounds } = options;
    let offset = 0;
    const adjustedBounds = {
      min: { ...planeBounds.min },
      max: { ...planeBounds.max }
    };
    if (width && (align === "center" || align === "right")) {
      const lineWidth = planeBounds.max.x - planeBounds.min.x;
      if (align === "center") {
        offset = (width - lineWidth) / 2 - planeBounds.min.x;
      } else {
        offset = width - planeBounds.max.x;
      }
    }
    if (offset !== 0) {
      adjustedBounds.min.x += offset;
      adjustedBounds.max.x += offset;
    }
    return { offset, adjustedBounds };
  }
}
var FONT_SIGNATURE_TRUE_TYPE = 65536;
var FONT_SIGNATURE_OPEN_TYPE_CFF = 1330926671;
var FONT_SIGNATURE_WOFF = 2001684038;
var FONT_SIGNATURE_WOFF2 = 2001684018;
var TABLE_TAG_HEAD = 1751474532;
var TABLE_TAG_HHEA = 1751672161;
var TABLE_TAG_OS2 = 1330851634;
var TABLE_TAG_FVAR = 1719034226;
var TABLE_TAG_STAT = 1398030676;
var TABLE_TAG_NAME = 1851878757;
var TABLE_TAG_CFF = 1128678944;
var TABLE_TAG_CFF2 = 1128678962;
var TABLE_TAG_GSUB = 1196643650;
var TABLE_TAG_GPOS = 1196445523;
function parseTableDirectory(view) {
  const numTables = view.getUint16(4);
  const tableRecordsStart = 12;
  const tables = new Map;
  for (let i = 0;i < numTables; i++) {
    const recordOffset = tableRecordsStart + i * 16;
    if (recordOffset + 16 > view.byteLength) {
      break;
    }
    const tag = view.getUint32(recordOffset);
    const checksum = view.getUint32(recordOffset + 4);
    const offset = view.getUint32(recordOffset + 8);
    const length = view.getUint32(recordOffset + 12);
    tables.set(tag, { tag, checksum, offset, length });
  }
  return tables;
}
var TAG_SS_PREFIX = 29555;
var TAG_CV_PREFIX = 25462;
var utf16beDecoder = new TextDecoder("utf-16be");

class FontMetadataExtractor {
  static extractMetadata(fontBuffer) {
    if (!fontBuffer || fontBuffer.byteLength < 12) {
      throw new Error("Invalid font buffer: too small to be a valid font file");
    }
    const view = new DataView(fontBuffer);
    const sfntVersion = view.getUint32(0);
    const validSignatures = [
      FONT_SIGNATURE_TRUE_TYPE,
      FONT_SIGNATURE_OPEN_TYPE_CFF
    ];
    if (!validSignatures.includes(sfntVersion)) {
      throw new Error(`Invalid font format. Expected TTF/OTF/WOFF/WOFF2, got signature: 0x${sfntVersion.toString(16)}`);
    }
    const tableDirectory = parseTableDirectory(view);
    const isCFF = tableDirectory.has(TABLE_TAG_CFF) || tableDirectory.has(TABLE_TAG_CFF2);
    const headTableOffset = tableDirectory.get(TABLE_TAG_HEAD)?.offset ?? 0;
    const hheaTableOffset = tableDirectory.get(TABLE_TAG_HHEA)?.offset ?? 0;
    const os2TableOffset = tableDirectory.get(TABLE_TAG_OS2)?.offset ?? 0;
    const fvarTableOffset = tableDirectory.get(TABLE_TAG_FVAR)?.offset ?? 0;
    const statTableOffset = tableDirectory.get(TABLE_TAG_STAT)?.offset ?? 0;
    const nameTableOffset = tableDirectory.get(TABLE_TAG_NAME)?.offset ?? 0;
    const unitsPerEm = headTableOffset ? view.getUint16(headTableOffset + 18) : 1000;
    let hheaMetrics = null;
    if (hheaTableOffset) {
      hheaMetrics = {
        ascender: view.getInt16(hheaTableOffset + 4),
        descender: view.getInt16(hheaTableOffset + 6),
        lineGap: view.getInt16(hheaTableOffset + 8)
      };
    }
    let os2Metrics = null;
    if (os2TableOffset) {
      os2Metrics = {
        typoAscender: view.getInt16(os2TableOffset + 68),
        typoDescender: view.getInt16(os2TableOffset + 70),
        typoLineGap: view.getInt16(os2TableOffset + 72),
        winAscent: view.getUint16(os2TableOffset + 74),
        winDescent: view.getUint16(os2TableOffset + 76)
      };
    }
    let axisNames = null;
    if (fvarTableOffset && statTableOffset && nameTableOffset) {
      axisNames = this.extractAxisNames(view, statTableOffset, nameTableOffset);
    }
    return {
      isCFF,
      unitsPerEm,
      hheaAscender: hheaMetrics?.ascender || null,
      hheaDescender: hheaMetrics?.descender || null,
      hheaLineGap: hheaMetrics?.lineGap || null,
      typoAscender: os2Metrics?.typoAscender || null,
      typoDescender: os2Metrics?.typoDescender || null,
      typoLineGap: os2Metrics?.typoLineGap || null,
      winAscent: os2Metrics?.winAscent || null,
      winDescent: os2Metrics?.winDescent || null,
      axisNames
    };
  }
  static extractFeatureTags(fontBuffer) {
    const view = new DataView(fontBuffer);
    const tableDirectory = parseTableDirectory(view);
    const gsubTableOffset = tableDirectory.get(TABLE_TAG_GSUB)?.offset ?? 0;
    const gposTableOffset = tableDirectory.get(TABLE_TAG_GPOS)?.offset ?? 0;
    const nameTableOffset = tableDirectory.get(TABLE_TAG_NAME)?.offset ?? 0;
    const features = new Set;
    const featureNames = {};
    try {
      if (gsubTableOffset) {
        const gsubData = this.extractFeatureDataFromTable(view, gsubTableOffset, nameTableOffset);
        gsubData.features.forEach((f) => features.add(f));
        Object.assign(featureNames, gsubData.names);
      }
      if (gposTableOffset) {
        const gposData = this.extractFeatureDataFromTable(view, gposTableOffset, nameTableOffset);
        gposData.features.forEach((f) => features.add(f));
        Object.assign(featureNames, gposData.names);
      }
    } catch (e) {
      return;
    }
    const featureArray = Array.from(features).sort();
    if (featureArray.length === 0)
      return;
    return {
      tags: featureArray,
      names: Object.keys(featureNames).length > 0 ? featureNames : {}
    };
  }
  static extractFeatureDataFromTable(view, tableOffset, nameTableOffset) {
    const featureListOffset = view.getUint16(tableOffset + 6);
    const featureListStart = tableOffset + featureListOffset;
    const featureCount = view.getUint16(featureListStart);
    const features = [];
    const names = {};
    for (let i = 0;i < featureCount; i++) {
      const recordOffset = featureListStart + 2 + i * 6;
      const tag = String.fromCharCode(view.getUint8(recordOffset), view.getUint8(recordOffset + 1), view.getUint8(recordOffset + 2), view.getUint8(recordOffset + 3));
      features.push(tag);
      if (/^(ss\d{2}|cv\d{2})$/.test(tag) && nameTableOffset) {
        const featureOffset = view.getUint16(recordOffset + 4);
        const featureTableStart = featureListStart + featureOffset;
        const featureParamsOffset = view.getUint16(featureTableStart);
        if (featureParamsOffset !== 0) {
          const paramsStart = featureTableStart + featureParamsOffset;
          const version = view.getUint16(paramsStart);
          if (version === 0) {
            const nameID = view.getUint16(paramsStart + 2);
            const name = this.getNameFromNameTable(view, nameTableOffset, nameID);
            if (name) {
              names[tag] = name;
            }
          }
        }
      }
    }
    return { features, names };
  }
  static extractAxisNames(view, statOffset, nameOffset) {
    try {
      const majorVersion = view.getUint16(statOffset);
      if (majorVersion < 1)
        return null;
      const designAxisSize = view.getUint16(statOffset + 4);
      const designAxisCount = view.getUint16(statOffset + 6);
      const designAxisOffset = view.getUint32(statOffset + 8);
      const axisNames = {};
      for (let i = 0;i < designAxisCount; i++) {
        const axisRecordOffset = statOffset + designAxisOffset + i * designAxisSize;
        const axisTag = String.fromCharCode(view.getUint8(axisRecordOffset), view.getUint8(axisRecordOffset + 1), view.getUint8(axisRecordOffset + 2), view.getUint8(axisRecordOffset + 3));
        const axisNameID = view.getUint16(axisRecordOffset + 4);
        const name = this.getNameFromNameTable(view, nameOffset, axisNameID);
        if (name) {
          axisNames[axisTag] = name;
        }
      }
      return Object.keys(axisNames).length > 0 ? axisNames : null;
    } catch (e) {
      return null;
    }
  }
  static getNameFromNameTable(view, nameOffset, nameID) {
    try {
      const count = view.getUint16(nameOffset + 2);
      const stringOffset = view.getUint16(nameOffset + 4);
      for (let i = 0;i < count; i++) {
        const recordOffset = nameOffset + 6 + i * 12;
        const platformID = view.getUint16(recordOffset);
        const encodingID = view.getUint16(recordOffset + 2);
        const languageID = view.getUint16(recordOffset + 4);
        const recordNameID = view.getUint16(recordOffset + 6);
        const length = view.getUint16(recordOffset + 8);
        const offset = view.getUint16(recordOffset + 10);
        if (recordNameID !== nameID)
          continue;
        if (platformID !== 0 && !(platformID === 3 && languageID === 1033)) {
          continue;
        }
        const stringStart = nameOffset + stringOffset + offset;
        const bytes = new Uint8Array(view.buffer, stringStart, length);
        if (platformID === 0 || platformID === 3 && encodingID === 1) {
          let str = "";
          for (let j = 0;j < bytes.length; j += 2) {
            str += String.fromCharCode(bytes[j] << 8 | bytes[j + 1]);
          }
          return str;
        }
        return new TextDecoder("ascii").decode(bytes);
      }
      return null;
    } catch (e) {
      return null;
    }
  }
  static extractAll(fontBuffer) {
    if (!fontBuffer || fontBuffer.byteLength < 12) {
      throw new Error("Invalid font buffer: too small to be a valid font file");
    }
    const view = new DataView(fontBuffer);
    const sfntVersion = view.getUint32(0);
    const validSignatures = [
      FONT_SIGNATURE_TRUE_TYPE,
      FONT_SIGNATURE_OPEN_TYPE_CFF
    ];
    if (!validSignatures.includes(sfntVersion)) {
      throw new Error(`Invalid font format. Expected TTF/OTF/WOFF/WOFF2, got signature: 0x${sfntVersion.toString(16)}`);
    }
    const tableDirectory = parseTableDirectory(view);
    const nameTableOffset = tableDirectory.get(TABLE_TAG_NAME)?.offset ?? 0;
    const nameIndex = nameTableOffset ? this.buildNameIndex(view, nameTableOffset) : null;
    const metrics = this.extractMetricsWithIndex(view, tableDirectory, nameIndex);
    const features = this.extractFeaturesWithIndex(view, tableDirectory, nameIndex);
    return { metrics, features };
  }
  static buildNameIndex(view, nameOffset) {
    const index = new Map;
    const count = view.getUint16(nameOffset + 2);
    const stringOffset = view.getUint16(nameOffset + 4);
    for (let i = 0;i < count; i++) {
      const recordOffset = nameOffset + 6 + i * 12;
      const platformID = view.getUint16(recordOffset);
      const encodingID = view.getUint16(recordOffset + 2);
      const languageID = view.getUint16(recordOffset + 4);
      const nameID = view.getUint16(recordOffset + 6);
      const length = view.getUint16(recordOffset + 8);
      const offset = view.getUint16(recordOffset + 10);
      if (platformID === 0 || platformID === 3 && languageID === 1033) {
        if (!index.has(nameID)) {
          index.set(nameID, {
            offset: nameOffset + stringOffset + offset,
            length,
            platformID,
            encodingID
          });
        }
      }
    }
    return index;
  }
  static getNameFromIndex(view, nameIndex, nameID) {
    if (!nameIndex)
      return null;
    const record = nameIndex.get(nameID);
    if (!record)
      return null;
    try {
      const bytes = new Uint8Array(view.buffer, record.offset, record.length);
      if (record.platformID === 0 || record.platformID === 3 && record.encodingID === 1) {
        return utf16beDecoder.decode(bytes);
      }
      return new TextDecoder("ascii").decode(bytes);
    } catch {
      return null;
    }
  }
  static extractMetricsWithIndex(view, tableDirectory, nameIndex) {
    const isCFF = tableDirectory.has(TABLE_TAG_CFF) || tableDirectory.has(TABLE_TAG_CFF2);
    const headTableOffset = tableDirectory.get(TABLE_TAG_HEAD)?.offset ?? 0;
    const hheaTableOffset = tableDirectory.get(TABLE_TAG_HHEA)?.offset ?? 0;
    const os2TableOffset = tableDirectory.get(TABLE_TAG_OS2)?.offset ?? 0;
    const fvarTableOffset = tableDirectory.get(TABLE_TAG_FVAR)?.offset ?? 0;
    const statTableOffset = tableDirectory.get(TABLE_TAG_STAT)?.offset ?? 0;
    const unitsPerEm = headTableOffset ? view.getUint16(headTableOffset + 18) : 1000;
    let hheaMetrics = null;
    if (hheaTableOffset) {
      hheaMetrics = {
        ascender: view.getInt16(hheaTableOffset + 4),
        descender: view.getInt16(hheaTableOffset + 6),
        lineGap: view.getInt16(hheaTableOffset + 8)
      };
    }
    let os2Metrics = null;
    if (os2TableOffset) {
      os2Metrics = {
        typoAscender: view.getInt16(os2TableOffset + 68),
        typoDescender: view.getInt16(os2TableOffset + 70),
        typoLineGap: view.getInt16(os2TableOffset + 72),
        winAscent: view.getUint16(os2TableOffset + 74),
        winDescent: view.getUint16(os2TableOffset + 76)
      };
    }
    let axisNames = null;
    if (fvarTableOffset && statTableOffset && nameIndex) {
      axisNames = this.extractAxisNamesWithIndex(view, statTableOffset, nameIndex);
    }
    return {
      isCFF,
      unitsPerEm,
      hheaAscender: hheaMetrics?.ascender || null,
      hheaDescender: hheaMetrics?.descender || null,
      hheaLineGap: hheaMetrics?.lineGap || null,
      typoAscender: os2Metrics?.typoAscender || null,
      typoDescender: os2Metrics?.typoDescender || null,
      typoLineGap: os2Metrics?.typoLineGap || null,
      winAscent: os2Metrics?.winAscent || null,
      winDescent: os2Metrics?.winDescent || null,
      axisNames
    };
  }
  static extractAxisNamesWithIndex(view, statOffset, nameIndex) {
    try {
      const majorVersion = view.getUint16(statOffset);
      if (majorVersion < 1)
        return null;
      const designAxisSize = view.getUint16(statOffset + 4);
      const designAxisCount = view.getUint16(statOffset + 6);
      const designAxisOffset = view.getUint32(statOffset + 8);
      const axisNames = {};
      for (let i = 0;i < designAxisCount; i++) {
        const axisRecordOffset = statOffset + designAxisOffset + i * designAxisSize;
        const axisTag = String.fromCharCode(view.getUint8(axisRecordOffset), view.getUint8(axisRecordOffset + 1), view.getUint8(axisRecordOffset + 2), view.getUint8(axisRecordOffset + 3));
        const axisNameID = view.getUint16(axisRecordOffset + 4);
        const name = this.getNameFromIndex(view, nameIndex, axisNameID);
        if (name) {
          axisNames[axisTag] = name;
        }
      }
      return Object.keys(axisNames).length > 0 ? axisNames : null;
    } catch {
      return null;
    }
  }
  static extractFeaturesWithIndex(view, tableDirectory, nameIndex) {
    const gsubTableOffset = tableDirectory.get(TABLE_TAG_GSUB)?.offset ?? 0;
    const gposTableOffset = tableDirectory.get(TABLE_TAG_GPOS)?.offset ?? 0;
    const featureTags = new Set;
    const featureNames = {};
    try {
      if (gsubTableOffset) {
        this.extractFeatureData(view, gsubTableOffset, nameIndex, featureTags, featureNames);
      }
      if (gposTableOffset) {
        this.extractFeatureData(view, gposTableOffset, nameIndex, featureTags, featureNames);
      }
    } catch {
      return;
    }
    if (featureTags.size === 0)
      return;
    const sortedTags = Array.from(featureTags).sort((a, b) => a - b);
    const featureArray = sortedTags.map(this.tagToString);
    return {
      tags: featureArray,
      names: Object.keys(featureNames).length > 0 ? featureNames : {}
    };
  }
  static extractFeatureData(view, tableOffset, nameIndex, featureTags, featureNames) {
    const featureListOffset = view.getUint16(tableOffset + 6);
    const featureListStart = tableOffset + featureListOffset;
    const featureCount = view.getUint16(featureListStart);
    for (let i = 0;i < featureCount; i++) {
      const recordOffset = featureListStart + 2 + i * 6;
      const tagBytes = view.getUint32(recordOffset);
      featureTags.add(tagBytes);
      const prefix = tagBytes >> 16 & 65535;
      if (!nameIndex)
        continue;
      if (prefix !== TAG_SS_PREFIX && prefix !== TAG_CV_PREFIX)
        continue;
      const d1 = tagBytes >> 8 & 255;
      const d2 = tagBytes & 255;
      if (d1 < 48 || d1 > 57 || d2 < 48 || d2 > 57)
        continue;
      const featureOffset = view.getUint16(recordOffset + 4);
      const featureTableStart = featureListStart + featureOffset;
      const featureParamsOffset = view.getUint16(featureTableStart);
      if (featureParamsOffset === 0)
        continue;
      const paramsStart = featureTableStart + featureParamsOffset;
      const version = view.getUint16(paramsStart);
      if (version !== 0)
        continue;
      const nameID = view.getUint16(paramsStart + 2);
      const name = this.getNameFromIndex(view, nameIndex, nameID);
      if (name) {
        const tag = String.fromCharCode(tagBytes >> 24 & 255, tagBytes >> 16 & 255, tagBytes >> 8 & 255, tagBytes & 255);
        featureNames[tag] = name;
      }
    }
  }
  static tagToString(tag) {
    return String.fromCharCode(tag >> 24 & 255, tag >> 16 & 255, tag >> 8 & 255, tag & 255);
  }
  static getVerticalMetrics(metrics) {
    if (metrics.typoAscender !== null && metrics.typoDescender !== null) {
      return {
        ascender: metrics.typoAscender,
        descender: metrics.typoDescender,
        lineGap: 0
      };
    }
    if (metrics.hheaAscender !== null && metrics.hheaDescender !== null) {
      return {
        ascender: metrics.hheaAscender,
        descender: metrics.hheaDescender,
        lineGap: 0
      };
    }
    if (metrics.winAscent !== null && metrics.winDescent !== null) {
      return {
        ascender: metrics.winAscent,
        descender: -metrics.winDescent,
        lineGap: 0
      };
    }
    return {
      ascender: Math.round(metrics.unitsPerEm * 0.8),
      descender: -Math.round(metrics.unitsPerEm * 0.2),
      lineGap: 0
    };
  }
  static getFontMetrics(metrics) {
    const verticalMetrics = FontMetadataExtractor.getVerticalMetrics(metrics);
    return {
      ascender: verticalMetrics.ascender,
      descender: verticalMetrics.descender,
      lineGap: verticalMetrics.lineGap,
      unitsPerEm: metrics.unitsPerEm,
      naturalLineHeight: verticalMetrics.ascender - verticalMetrics.descender
    };
  }
}
var woff2Decoder = null;
function setWoff2Decoder(decoder) {
  woff2Decoder = decoder;
}

class WoffConverter {
  static detectFormat(buffer) {
    if (buffer.byteLength < 4) {
      return "ttf/otf";
    }
    const view = new DataView(buffer);
    const signature = view.getUint32(0);
    if (signature === FONT_SIGNATURE_WOFF) {
      return "woff";
    }
    if (signature === FONT_SIGNATURE_WOFF2) {
      return "woff2";
    }
    return "ttf/otf";
  }
  static async decompressWoff(woffBuffer) {
    const view = new DataView(woffBuffer);
    const data = new Uint8Array(woffBuffer);
    const signature = view.getUint32(0);
    if (signature !== FONT_SIGNATURE_WOFF) {
      throw new Error("Not a valid WOFF font");
    }
    const flavor = view.getUint32(4);
    const numTables = view.getUint16(12);
    const totalSfntSize = view.getUint32(16);
    if (typeof DecompressionStream === "undefined") {
      throw new Error("WOFF fonts require DecompressionStream API (Chrome 80+, Firefox 113+, Safari 16.4+). " + "Please use TTF/OTF fonts or upgrade your browser.");
    }
    const sfntData = new Uint8Array(totalSfntSize);
    const sfntView = new DataView(sfntData.buffer);
    sfntView.setUint32(0, flavor);
    sfntView.setUint16(4, numTables);
    const searchRange = 2 ** Math.floor(Math.log2(numTables)) * 16;
    sfntView.setUint16(6, searchRange);
    sfntView.setUint16(8, Math.floor(Math.log2(numTables)));
    sfntView.setUint16(10, numTables * 16 - searchRange);
    let sfntOffset = 12 + numTables * 16;
    const tableDirectory = [];
    for (let i = 0;i < numTables; i++) {
      const tableOffset = 44 + i * 20;
      tableDirectory.push({
        tag: view.getUint32(tableOffset),
        offset: view.getUint32(tableOffset + 4),
        length: view.getUint32(tableOffset + 8),
        origLength: view.getUint32(tableOffset + 12),
        checksum: view.getUint32(tableOffset + 16)
      });
    }
    tableDirectory.sort((a, b) => a.tag - b.tag);
    const decompressedTables = await Promise.all(tableDirectory.map(async (table) => {
      if (table.length === table.origLength) {
        return data.subarray(table.offset, table.offset + table.length);
      }
      const compressedData = data.subarray(table.offset, table.offset + table.length);
      const decompressed = await WoffConverter.decompressZlib(compressedData);
      if (decompressed.byteLength !== table.origLength) {
        throw new Error(`Decompression failed: expected ${table.origLength} bytes, got ${decompressed.byteLength}`);
      }
      return new Uint8Array(decompressed);
    }));
    for (let i = 0;i < numTables; i++) {
      const table = tableDirectory[i];
      const dirOffset = 12 + i * 16;
      sfntView.setUint32(dirOffset, table.tag);
      sfntView.setUint32(dirOffset + 4, table.checksum);
      sfntView.setUint32(dirOffset + 8, sfntOffset);
      sfntView.setUint32(dirOffset + 12, table.origLength);
      sfntData.set(decompressedTables[i], sfntOffset);
      sfntOffset += table.origLength;
      const padding = (4 - table.origLength % 4) % 4;
      sfntOffset += padding;
    }
    logger.log("WOFF font decompressed successfully");
    return sfntData.buffer.slice(0, sfntOffset);
  }
  static async decompressWoff2(woff2Buffer) {
    const view = new DataView(woff2Buffer);
    const signature = view.getUint32(0);
    if (signature !== FONT_SIGNATURE_WOFF2) {
      throw new Error("Not a valid WOFF2 font");
    }
    if (!woff2Decoder) {
      throw new Error(`WOFF2 fonts require enabling the decoder. Add to your code:
` + `  import { woff2Decode } from 'woff-lib/woff2/decode';
` + "  Text.enableWoff2(woff2Decode);");
    }
    const decoded = await woff2Decoder(woff2Buffer);
    logger.log("WOFF2 font decompressed successfully");
    return decoded.buffer;
  }
  static async decompressZlib(compressedData) {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(compressedData);
        controller.close();
      }
    }).pipeThrough(new DecompressionStream("deflate"));
    const response = new Response(stream);
    return response.arrayBuffer();
  }
}

class FontLoader {
  constructor(getHarfBuzzInstance) {
    this.getHarfBuzzInstance = getHarfBuzzInstance;
  }
  async loadFont(fontBuffer, fontVariations) {
    perfLogger.start("FontLoader.loadFont", {
      bufferSize: fontBuffer.byteLength
    });
    if (!fontBuffer || fontBuffer.byteLength < 12) {
      throw new Error("Invalid font buffer: too small to be a valid font file");
    }
    const format = WoffConverter.detectFormat(fontBuffer);
    if (format === "woff") {
      logger.log("WOFF font detected, decompressing...");
      fontBuffer = await WoffConverter.decompressWoff(fontBuffer);
    } else if (format === "woff2") {
      logger.log("WOFF2 font detected, decompressing...");
      fontBuffer = await WoffConverter.decompressWoff2(fontBuffer);
    }
    const view = new DataView(fontBuffer);
    const sfntVersion = view.getUint32(0);
    const validSignatures = [
      FONT_SIGNATURE_TRUE_TYPE,
      FONT_SIGNATURE_OPEN_TYPE_CFF
    ];
    if (!validSignatures.includes(sfntVersion)) {
      throw new Error(`Invalid font format. Expected TTF/OTF/WOFF/WOFF2, got signature: 0x${sfntVersion.toString(16)}`);
    }
    const { hb, module } = await this.getHarfBuzzInstance();
    try {
      const fontBlob = hb.createBlob(new Uint8Array(fontBuffer));
      const face = hb.createFace(fontBlob, 0);
      const font = hb.createFont(face);
      if (fontVariations) {
        font.setVariations(fontVariations);
      }
      const axisInfos = face.getAxisInfos();
      const isVariable = Object.keys(axisInfos).length > 0;
      const { metrics, features: featureData } = FontMetadataExtractor.extractAll(fontBuffer);
      let variationAxes = undefined;
      if (isVariable && axisInfos) {
        variationAxes = {};
        for (const [tag, info] of Object.entries(axisInfos)) {
          variationAxes[tag] = {
            ...info,
            name: metrics.axisNames?.[tag] || null
          };
        }
      }
      return {
        hb,
        fontBlob,
        face,
        font,
        module,
        upem: metrics.unitsPerEm,
        metrics,
        fontVariations,
        isVariable,
        variationAxes,
        availableFeatures: featureData?.tags,
        featureNames: featureData?.names,
        _buffer: fontBuffer
      };
    } catch (error2) {
      logger.error("Failed to load font:", error2);
      throw error2;
    } finally {
      perfLogger.end("FontLoader.loadFont");
    }
  }
  static destroyFont(loadedFont) {
    try {
      if (loadedFont.font && typeof loadedFont.font.destroy === "function") {
        loadedFont.font.destroy();
      }
      if (loadedFont.face && typeof loadedFont.face.destroy === "function") {
        loadedFont.face.destroy();
      }
      if (loadedFont.fontBlob && typeof loadedFont.fontBlob.destroy === "function") {
        loadedFont.fontBlob.destroy();
      }
    } catch (error2) {
      logger.error("Error destroying font resources:", error2);
    }
  }
}
var SAFE_LANGUAGE_RE = /^[a-z]{2,3}(?:-[a-z0-9]{2,16})*$/i;
var BUILTIN_PATTERN_LANGUAGES = new Set([
  "af",
  "as",
  "be",
  "bg",
  "bn",
  "ca",
  "cy",
  "da",
  "de-1996",
  "el-monoton",
  "el-polyton",
  "en-gb",
  "en-us",
  "eo",
  "es",
  "et",
  "eu",
  "fi",
  "fr",
  "fur",
  "ga",
  "gl",
  "gu",
  "hi",
  "hr",
  "hsb",
  "hu",
  "hy",
  "ia",
  "is",
  "it",
  "ka",
  "kmr",
  "kn",
  "la",
  "lt",
  "lv",
  "ml",
  "mn-cyrl",
  "mr",
  "mul-ethi",
  "nb",
  "nl",
  "nn",
  "oc",
  "or",
  "pa",
  "pl",
  "pms",
  "pt",
  "rm",
  "ro",
  "ru",
  "sa",
  "sh-cyrl",
  "sh-latn",
  "sk",
  "sl",
  "sq",
  "sv",
  "ta",
  "te",
  "th",
  "tk",
  "tr",
  "uk",
  "zh-latn-pinyin"
]);
async function loadPattern(language, patternsPath) {
  if (!SAFE_LANGUAGE_RE.test(language)) {
    throw new Error(`Invalid hyphenation language code "${language}". Expected e.g. "en-us".`);
  }
  if (!patternsPath && !BUILTIN_PATTERN_LANGUAGES.has(language)) {
    throw new Error(`Unsupported hyphenation language "${language}". ` + `Use a built-in language (e.g. "en-us") or register patterns via Text.registerPattern("${language}", pattern).`);
  }
  {
    try {
      if (patternsPath) {
        const module = await import(`${patternsPath}${language}.js`);
        return module.default;
      } else if (typeof import.meta?.url === "string") {
        const baseUrl = new URL(".", import.meta.url).href;
        const patternUrl = new URL(`./patterns/${language}.js`, baseUrl).href;
        const module = await import(patternUrl);
        return module.default;
      } else {
        const module = await import(`./patterns/${language}.js`);
        return module.default;
      }
    } catch (error2) {
      throw new Error(`Failed to load hyphenation patterns for ${language}. Consider using static imports: import pattern from 'three-text/patterns/${language}'; Text.registerPattern('${language}', pattern);`);
    }
  }
}

class Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }
  clone() {
    return new Vec2(this.x, this.y);
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    return this;
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }
  multiply(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }
  divide(scalar) {
    this.x /= scalar;
    this.y /= scalar;
    return this;
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  lengthSq() {
    return this.x * this.x + this.y * this.y;
  }
  normalize() {
    const len = this.length();
    if (len > 0) {
      this.divide(len);
    }
    return this;
  }
  dot(v) {
    return this.x * v.x + this.y * v.y;
  }
  distanceTo(v) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  distanceToSquared(v) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return dx * dx + dy * dy;
  }
  equals(v) {
    return this.x === v.x && this.y === v.y;
  }
  angle() {
    return Math.atan2(this.y, this.x);
  }
}

class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  clone() {
    return new Vec3(this.x, this.y, this.z);
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }
  multiply(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this;
  }
  divide(scalar) {
    this.x /= scalar;
    this.y /= scalar;
    this.z /= scalar;
    return this;
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  normalize() {
    const len = this.length();
    if (len > 0) {
      this.divide(len);
    }
    return this;
  }
  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  cross(v) {
    const x = this.y * v.z - this.z * v.y;
    const y = this.z * v.x - this.x * v.z;
    const z = this.x * v.y - this.y * v.x;
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  distanceTo(v) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    const dz = this.z - v.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  distanceToSquared(v) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    const dz = this.z - v.z;
    return dx * dx + dy * dy + dz * dz;
  }
  equals(v) {
    return this.x === v.x && this.y === v.y && this.z === v.z;
  }
}

class TextShaper {
  constructor(loadedFont) {
    this.cachedSpaceWidth = new Map;
    this.loadedFont = loadedFont;
  }
  shapeLines(lineInfos, scaledLineHeight, letterSpacing, align, direction, color, originalText) {
    perfLogger.start("TextShaper.shapeLines", {
      lineCount: lineInfos.length
    });
    try {
      const clustersByLine = [];
      lineInfos.forEach((lineInfo, lineIndex) => {
        const clusters = this.shapeLineIntoClusters(lineInfo, lineIndex, scaledLineHeight, letterSpacing, align, direction);
        clustersByLine.push(clusters);
      });
      return clustersByLine;
    } finally {
      perfLogger.end("TextShaper.shapeLines");
    }
  }
  shapeLineIntoClusters(lineInfo, lineIndex, scaledLineHeight, letterSpacing, align, direction) {
    const buffer = this.loadedFont.hb.createBuffer();
    if (direction === "rtl") {
      buffer.setDirection("rtl");
    }
    buffer.addText(lineInfo.text);
    buffer.guessSegmentProperties();
    const featuresString = convertFontFeaturesToString(this.loadedFont.fontFeatures);
    this.loadedFont.hb.shape(this.loadedFont.font, buffer, featuresString);
    const glyphInfos = buffer.json(this.loadedFont.font);
    buffer.destroy();
    const clusters = [];
    let currentClusterGlyphs = [];
    let clusterTextChars = [];
    let clusterStartX = 0;
    let clusterStartY = 0;
    let cursorX = lineInfo.xOffset;
    let cursorY = -lineIndex * scaledLineHeight;
    const cursorZ = 0;
    const letterSpacingFU = letterSpacing * this.loadedFont.upem;
    const spaceAdjustment = this.calculateSpaceAdjustment(lineInfo, align, letterSpacing);
    const cjkAdjustment = this.calculateCJKAdjustment(lineInfo, align);
    const lineText = lineInfo.text;
    const lineTextLength = lineText.length;
    const glyphCount = glyphInfos.length;
    let nextCharIsCJK;
    for (let i = 0;i < glyphCount; i++) {
      const glyph = glyphInfos[i];
      const charIndex = glyph.cl;
      const char = lineText[charIndex];
      const charCode = char.charCodeAt(0);
      const isWhitespace = charCode === 32 || charCode === 9 || charCode === 10 || charCode === 13;
      if (lineInfo.endedWithHyphen && charIndex === lineTextLength - 1 && char === "-") {
        glyph.absoluteTextIndex = lineInfo.originalEnd;
      } else {
        glyph.absoluteTextIndex = lineInfo.originalStart + charIndex;
      }
      glyph.lineIndex = lineIndex;
      if (isWhitespace) {
        if (currentClusterGlyphs.length > 0) {
          clusters.push({
            text: clusterTextChars.join(""),
            glyphs: currentClusterGlyphs,
            position: new Vec3(clusterStartX, clusterStartY, cursorZ)
          });
          currentClusterGlyphs = [];
          clusterTextChars = [];
        }
      }
      const absoluteGlyphX = cursorX + glyph.dx;
      const absoluteGlyphY = cursorY + glyph.dy;
      if (!isWhitespace) {
        if (currentClusterGlyphs.length === 0) {
          clusterStartX = absoluteGlyphX;
          clusterStartY = absoluteGlyphY;
        }
        glyph.x = absoluteGlyphX - clusterStartX;
        glyph.y = absoluteGlyphY - clusterStartY;
        currentClusterGlyphs.push(glyph);
        clusterTextChars.push(char);
      }
      cursorX += glyph.ax;
      cursorY += glyph.ay;
      if (letterSpacingFU !== 0 && i < glyphCount - 1) {
        cursorX += letterSpacingFU;
      }
      if (isWhitespace) {
        cursorX += spaceAdjustment;
      }
      if (cjkAdjustment !== 0 && i < glyphCount - 1 && !isWhitespace) {
        const nextGlyph = glyphInfos[i + 1];
        const nextChar = lineText[nextGlyph.cl];
        const isCJK = nextCharIsCJK !== undefined ? nextCharIsCJK : LineBreak.isCJK(char);
        nextCharIsCJK = nextChar ? LineBreak.isCJK(nextChar) : false;
        if (isCJK && nextCharIsCJK) {
          let shouldApply = true;
          if (LineBreak.isCJClosingPunctuation(nextChar)) {
            shouldApply = false;
          }
          if (LineBreak.isCJOpeningPunctuation(char)) {
            shouldApply = false;
          }
          if (LineBreak.isCJPunctuation(char) && LineBreak.isCJPunctuation(nextChar)) {
            shouldApply = false;
          }
          if (shouldApply) {
            cursorX += cjkAdjustment;
          }
        }
      } else {
        nextCharIsCJK = undefined;
      }
    }
    if (currentClusterGlyphs.length > 0) {
      clusters.push({
        text: clusterTextChars.join(""),
        glyphs: currentClusterGlyphs,
        position: new Vec3(clusterStartX, clusterStartY, cursorZ)
      });
    }
    return clusters;
  }
  calculateSpaceAdjustment(lineInfo, align, letterSpacing) {
    let spaceAdjustment = 0;
    if (lineInfo.adjustmentRatio !== undefined && align === "justify" && !lineInfo.isLastLine) {
      let naturalSpaceWidth = this.cachedSpaceWidth.get(letterSpacing);
      if (naturalSpaceWidth === undefined) {
        naturalSpaceWidth = TextMeasurer.measureTextWidth(this.loadedFont, " ", letterSpacing);
        this.cachedSpaceWidth.set(letterSpacing, naturalSpaceWidth);
      }
      const width = naturalSpaceWidth;
      const stretchFactor = SPACE_STRETCH_RATIO;
      const shrinkFactor = SPACE_SHRINK_RATIO;
      if (lineInfo.adjustmentRatio > 0) {
        spaceAdjustment = lineInfo.adjustmentRatio * width * stretchFactor;
      } else if (lineInfo.adjustmentRatio < 0) {
        spaceAdjustment = lineInfo.adjustmentRatio * width * shrinkFactor;
      }
    }
    return spaceAdjustment;
  }
  calculateCJKAdjustment(lineInfo, align) {
    if (lineInfo.adjustmentRatio === undefined || align !== "justify" || lineInfo.isLastLine) {
      return 0;
    }
    const baseCharWidth = this.loadedFont.upem;
    const glueStretch = baseCharWidth * 0.04;
    const glueShrink = baseCharWidth * 0.04;
    if (lineInfo.adjustmentRatio > 0) {
      return lineInfo.adjustmentRatio * glueStretch;
    } else if (lineInfo.adjustmentRatio < 0) {
      return lineInfo.adjustmentRatio * glueShrink;
    }
    return 0;
  }
}
async function loadBinary(filePath) {
  try {
    const res = await fetch(filePath);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.arrayBuffer();
  } catch (fetchError) {
    const req = globalThis.require;
    if (typeof req !== "function") {
      throw new Error(`Failed to fetch ${filePath}: ${fetchError}`);
    }
    try {
      const fs = req("fs");
      const nodePath = req("path");
      let resolvedPath = filePath;
      if (typeof window !== "undefined" && window.location?.protocol === "file:") {
        const dir = nodePath.dirname(window.location.pathname);
        resolvedPath = nodePath.join(dir, filePath);
      }
      const buffer = fs.readFileSync(resolvedPath);
      if (buffer instanceof ArrayBuffer)
        return buffer;
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    } catch (fsError) {
      throw new Error(`Failed to load ${filePath}: fetch failed (${fetchError}), fs.readFileSync failed (${fsError})`);
    }
  }
}
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
function getAugmentedNamespace(n) {
  if (n.__esModule)
    return n;
  var f = n.default;
  if (typeof f == "function") {
    var a = function a2() {
      if (this instanceof a2) {
        return Reflect.construct(f, arguments, this.constructor);
      }
      return f.apply(this, arguments);
    };
    a.prototype = f.prototype;
  } else
    a = {};
  Object.defineProperty(a, "__esModule", { value: true });
  Object.keys(n).forEach(function(k) {
    var d = Object.getOwnPropertyDescriptor(n, k);
    Object.defineProperty(a, k, d.get ? d : {
      enumerable: true,
      get: function() {
        return n[k];
      }
    });
  });
  return a;
}
var hb = { exports: {} };
var fs = {};
var readFileSync = (...args) => {
  const req = typeof globalThis !== "undefined" ? globalThis.require : undefined;
  if (typeof req === "function") {
    return req("fs").readFileSync(...args);
  }
  throw new Error("fs not available in this environment");
};
var fs$1 = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  default: fs,
  readFileSync
});
var require$$0 = /* @__PURE__ */ getAugmentedNamespace(fs$1);
(function(module, exports) {
  var createHarfBuzz = (() => {
    var _scriptName = typeof document != "undefined" ? document.currentScript?.src : undefined;
    return async function(moduleArg = {}) {
      var moduleRtn;
      var Module = moduleArg;
      var ENVIRONMENT_IS_WEB = typeof window == "object";
      var ENVIRONMENT_IS_WORKER = typeof WorkerGlobalScope != "undefined";
      var ENVIRONMENT_IS_NODE = typeof process == "object" && process.versions?.node && process.type != "renderer";
      var quit_ = (status, toThrow) => {
        throw toThrow;
      };
      if (typeof __filename != "undefined") {
        _scriptName = __filename;
      } else if (ENVIRONMENT_IS_WORKER) {
        _scriptName = self.location.href;
      }
      var scriptDirectory = "";
      function locateFile(path) {
        if (Module["locateFile"]) {
          return Module["locateFile"](path, scriptDirectory);
        }
        return scriptDirectory + path;
      }
      var readAsync, readBinary;
      if (ENVIRONMENT_IS_NODE) {
        var fs2 = require$$0;
        scriptDirectory = typeof __dirname !== "undefined" ? __dirname + "/" : "";
        readBinary = (filename) => {
          filename = isFileURI(filename) ? new URL(filename) : filename;
          var ret = fs2.readFileSync(filename);
          return ret;
        };
        readAsync = async (filename, binary = true) => {
          filename = isFileURI(filename) ? new URL(filename) : filename;
          var ret = fs2.readFileSync(filename, binary ? undefined : "utf8");
          return ret;
        };
        if (process.argv.length > 1) {
          process.argv[1].replace(/\\/g, "/");
        }
        process.argv.slice(2);
        quit_ = (status, toThrow) => {
          process.exitCode = status;
          throw toThrow;
        };
      } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
        try {
          scriptDirectory = new URL(".", _scriptName).href;
        } catch {}
        {
          if (ENVIRONMENT_IS_WORKER) {
            readBinary = (url) => {
              var xhr = new XMLHttpRequest;
              xhr.open("GET", url, false);
              xhr.responseType = "arraybuffer";
              xhr.send(null);
              return new Uint8Array(xhr.response);
            };
          }
          readAsync = async (url) => {
            if (isFileURI(url)) {
              return new Promise((resolve, reject) => {
                var xhr = new XMLHttpRequest;
                xhr.open("GET", url, true);
                xhr.responseType = "arraybuffer";
                xhr.onload = () => {
                  if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                    resolve(xhr.response);
                    return;
                  }
                  reject(xhr.status);
                };
                xhr.onerror = reject;
                xhr.send(null);
              });
            }
            var response = await fetch(url, { credentials: "same-origin" });
            if (response.ok) {
              return response.arrayBuffer();
            }
            throw new Error(response.status + " : " + response.url);
          };
        }
      } else
        ;
      console.log.bind(console);
      var err = console.error.bind(console);
      var wasmBinary;
      var ABORT = false;
      var EXITSTATUS;
      var isFileURI = (filename) => filename.startsWith("file://");
      var readyPromiseResolve, readyPromiseReject;
      var wasmMemory;
      var HEAPU8;
      var runtimeInitialized = false;
      function updateMemoryViews() {
        var b = wasmMemory.buffer;
        Module["HEAP8"] = new Int8Array(b);
        Module["HEAPU8"] = HEAPU8 = new Uint8Array(b);
        Module["HEAP32"] = new Int32Array(b);
        Module["HEAPU32"] = new Uint32Array(b);
        Module["HEAPF32"] = new Float32Array(b);
        new BigInt64Array(b);
        new BigUint64Array(b);
      }
      function preRun() {
        if (Module["preRun"]) {
          if (typeof Module["preRun"] == "function")
            Module["preRun"] = [Module["preRun"]];
          while (Module["preRun"].length) {
            addOnPreRun(Module["preRun"].shift());
          }
        }
        callRuntimeCallbacks(onPreRuns);
      }
      function initRuntime() {
        runtimeInitialized = true;
        wasmExports["__wasm_call_ctors"]();
      }
      function postRun() {
        if (Module["postRun"]) {
          if (typeof Module["postRun"] == "function")
            Module["postRun"] = [Module["postRun"]];
          while (Module["postRun"].length) {
            addOnPostRun(Module["postRun"].shift());
          }
        }
        callRuntimeCallbacks(onPostRuns);
      }
      var runDependencies = 0;
      var dependenciesFulfilled = null;
      function addRunDependency(id) {
        runDependencies++;
        Module["monitorRunDependencies"]?.(runDependencies);
      }
      function removeRunDependency(id) {
        runDependencies--;
        Module["monitorRunDependencies"]?.(runDependencies);
        if (runDependencies == 0) {
          if (dependenciesFulfilled) {
            var callback = dependenciesFulfilled;
            dependenciesFulfilled = null;
            callback();
          }
        }
      }
      function abort(what) {
        Module["onAbort"]?.(what);
        what = "Aborted(" + what + ")";
        err(what);
        ABORT = true;
        what += ". Build with -sASSERTIONS for more info.";
        var e = new WebAssembly.RuntimeError(what);
        readyPromiseReject?.(e);
        throw e;
      }
      var wasmBinaryFile;
      function findWasmBinary() {
        return locateFile("hb.wasm");
      }
      function getBinarySync(file) {
        if (file == wasmBinaryFile && wasmBinary) {
          return new Uint8Array(wasmBinary);
        }
        if (readBinary) {
          return readBinary(file);
        }
        throw "both async and sync fetching of the wasm failed";
      }
      async function getWasmBinary(binaryFile) {
        if (!wasmBinary) {
          try {
            var response = await readAsync(binaryFile);
            return new Uint8Array(response);
          } catch {}
        }
        return getBinarySync(binaryFile);
      }
      async function instantiateArrayBuffer(binaryFile, imports) {
        try {
          var binary = await getWasmBinary(binaryFile);
          var instance = await WebAssembly.instantiate(binary, imports);
          return instance;
        } catch (reason) {
          err(`failed to asynchronously prepare wasm: ${reason}`);
          abort(reason);
        }
      }
      async function instantiateAsync(binary, binaryFile, imports) {
        if (!binary && !isFileURI(binaryFile) && !ENVIRONMENT_IS_NODE) {
          try {
            var response = fetch(binaryFile, { credentials: "same-origin" });
            var instantiationResult = await WebAssembly.instantiateStreaming(response, imports);
            return instantiationResult;
          } catch (reason) {
            err(`wasm streaming compile failed: ${reason}`);
            err("falling back to ArrayBuffer instantiation");
          }
        }
        return instantiateArrayBuffer(binaryFile, imports);
      }
      function getWasmImports() {
        return { env: wasmImports, wasi_snapshot_preview1: wasmImports };
      }
      async function createWasm() {
        function receiveInstance(instance, module2) {
          wasmExports = instance.exports;
          Module["wasmExports"] = wasmExports;
          wasmMemory = wasmExports["memory"];
          Module["wasmMemory"] = wasmMemory;
          updateMemoryViews();
          wasmTable = wasmExports["__indirect_function_table"];
          assignWasmExports(wasmExports);
          removeRunDependency();
          return wasmExports;
        }
        addRunDependency();
        function receiveInstantiationResult(result2) {
          return receiveInstance(result2["instance"]);
        }
        var info = getWasmImports();
        if (Module["instantiateWasm"]) {
          return new Promise((resolve, reject) => {
            Module["instantiateWasm"](info, (mod, inst) => {
              resolve(receiveInstance(mod));
            });
          });
        }
        wasmBinaryFile ??= findWasmBinary();
        var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info);
        var exports2 = receiveInstantiationResult(result);
        return exports2;
      }

      class ExitStatus {
        name = "ExitStatus";
        constructor(status) {
          this.message = `Program terminated with exit(${status})`;
          this.status = status;
        }
      }
      var callRuntimeCallbacks = (callbacks) => {
        while (callbacks.length > 0) {
          callbacks.shift()(Module);
        }
      };
      var onPostRuns = [];
      var addOnPostRun = (cb) => onPostRuns.push(cb);
      var onPreRuns = [];
      var addOnPreRun = (cb) => onPreRuns.push(cb);
      var noExitRuntime = true;
      var __abort_js = () => abort("");
      var runtimeKeepaliveCounter = 0;
      var __emscripten_runtime_keepalive_clear = () => {
        noExitRuntime = false;
        runtimeKeepaliveCounter = 0;
      };
      var timers = {};
      var handleException = (e) => {
        if (e instanceof ExitStatus || e == "unwind") {
          return EXITSTATUS;
        }
        quit_(1, e);
      };
      var keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0;
      var _proc_exit = (code) => {
        EXITSTATUS = code;
        if (!keepRuntimeAlive()) {
          Module["onExit"]?.(code);
          ABORT = true;
        }
        quit_(code, new ExitStatus(code));
      };
      var exitJS = (status, implicit) => {
        EXITSTATUS = status;
        _proc_exit(status);
      };
      var _exit = exitJS;
      var maybeExit = () => {
        if (!keepRuntimeAlive()) {
          try {
            _exit(EXITSTATUS);
          } catch (e) {
            handleException(e);
          }
        }
      };
      var callUserCallback = (func) => {
        if (ABORT) {
          return;
        }
        try {
          func();
          maybeExit();
        } catch (e) {
          handleException(e);
        }
      };
      var _emscripten_get_now = () => performance.now();
      var __setitimer_js = (which, timeout_ms) => {
        if (timers[which]) {
          clearTimeout(timers[which].id);
          delete timers[which];
        }
        if (!timeout_ms)
          return 0;
        var id = setTimeout(() => {
          delete timers[which];
          callUserCallback(() => __emscripten_timeout(which, _emscripten_get_now()));
        }, timeout_ms);
        timers[which] = { id, timeout_ms };
        return 0;
      };
      var getHeapMax = () => 2147483648;
      var alignMemory = (size, alignment) => Math.ceil(size / alignment) * alignment;
      var growMemory = (size) => {
        var oldHeapSize = wasmMemory.buffer.byteLength;
        var pages = (size - oldHeapSize + 65535) / 65536 | 0;
        try {
          wasmMemory.grow(pages);
          updateMemoryViews();
          return 1;
        } catch (e) {}
      };
      var _emscripten_resize_heap = (requestedSize) => {
        var oldSize = HEAPU8.length;
        requestedSize >>>= 0;
        var maxHeapSize = getHeapMax();
        if (requestedSize > maxHeapSize) {
          return false;
        }
        for (var cutDown = 1;cutDown <= 4; cutDown *= 2) {
          var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
          overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
          var newSize = Math.min(maxHeapSize, alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536));
          var replacement = growMemory(newSize);
          if (replacement) {
            return true;
          }
        }
        return false;
      };
      var uleb128EncodeWithLen = (arr) => {
        const n = arr.length;
        return [n % 128 | 128, n >> 7, ...arr];
      };
      var wasmTypeCodes = { i: 127, p: 127, j: 126, f: 125, d: 124, e: 111 };
      var generateTypePack = (types) => uleb128EncodeWithLen(Array.from(types, (type) => {
        var code = wasmTypeCodes[type];
        return code;
      }));
      var convertJsFunctionToWasm = (func, sig) => {
        var bytes = Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0, 1, ...uleb128EncodeWithLen([1, 96, ...generateTypePack(sig.slice(1)), ...generateTypePack(sig[0] === "v" ? "" : sig[0])]), 2, 7, 1, 1, 101, 1, 102, 0, 0, 7, 5, 1, 1, 102, 0, 0);
        var module2 = new WebAssembly.Module(bytes);
        var instance = new WebAssembly.Instance(module2, { e: { f: func } });
        var wrappedFunc = instance.exports["f"];
        return wrappedFunc;
      };
      var wasmTable;
      var getWasmTableEntry = (funcPtr) => wasmTable.get(funcPtr);
      var updateTableMap = (offset, count) => {
        if (functionsInTableMap) {
          for (var i = offset;i < offset + count; i++) {
            var item = getWasmTableEntry(i);
            if (item) {
              functionsInTableMap.set(item, i);
            }
          }
        }
      };
      var functionsInTableMap;
      var getFunctionAddress = (func) => {
        if (!functionsInTableMap) {
          functionsInTableMap = new WeakMap;
          updateTableMap(0, wasmTable.length);
        }
        return functionsInTableMap.get(func) || 0;
      };
      var freeTableIndexes = [];
      var getEmptyTableSlot = () => {
        if (freeTableIndexes.length) {
          return freeTableIndexes.pop();
        }
        return wasmTable["grow"](1);
      };
      var setWasmTableEntry = (idx, func) => wasmTable.set(idx, func);
      var addFunction = (func, sig) => {
        var rtn = getFunctionAddress(func);
        if (rtn) {
          return rtn;
        }
        var ret = getEmptyTableSlot();
        try {
          setWasmTableEntry(ret, func);
        } catch (err2) {
          if (!(err2 instanceof TypeError)) {
            throw err2;
          }
          var wrapped = convertJsFunctionToWasm(func, sig);
          setWasmTableEntry(ret, wrapped);
        }
        functionsInTableMap.set(func, ret);
        return ret;
      };
      var removeFunction = (index) => {
        functionsInTableMap.delete(getWasmTableEntry(index));
        setWasmTableEntry(index, null);
        freeTableIndexes.push(index);
      };
      {
        if (Module["noExitRuntime"])
          noExitRuntime = Module["noExitRuntime"];
        if (Module["print"])
          Module["print"];
        if (Module["printErr"])
          err = Module["printErr"];
        if (Module["wasmBinary"])
          wasmBinary = Module["wasmBinary"];
        if (Module["arguments"])
          Module["arguments"];
        if (Module["thisProgram"])
          Module["thisProgram"];
      }
      Module["wasmMemory"] = wasmMemory;
      Module["wasmExports"] = wasmExports;
      Module["addFunction"] = addFunction;
      Module["removeFunction"] = removeFunction;
      var __emscripten_timeout;
      function assignWasmExports(wasmExports2) {
        Module["_hb_blob_create"] = wasmExports2["hb_blob_create"];
        Module["_hb_blob_destroy"] = wasmExports2["hb_blob_destroy"];
        Module["_hb_blob_get_length"] = wasmExports2["hb_blob_get_length"];
        Module["_hb_blob_get_data"] = wasmExports2["hb_blob_get_data"];
        Module["_hb_buffer_serialize_glyphs"] = wasmExports2["hb_buffer_serialize_glyphs"];
        Module["_hb_buffer_create"] = wasmExports2["hb_buffer_create"];
        Module["_hb_buffer_destroy"] = wasmExports2["hb_buffer_destroy"];
        Module["_hb_buffer_get_content_type"] = wasmExports2["hb_buffer_get_content_type"];
        Module["_hb_buffer_set_direction"] = wasmExports2["hb_buffer_set_direction"];
        Module["_hb_buffer_set_script"] = wasmExports2["hb_buffer_set_script"];
        Module["_hb_buffer_set_language"] = wasmExports2["hb_buffer_set_language"];
        Module["_hb_buffer_set_flags"] = wasmExports2["hb_buffer_set_flags"];
        Module["_hb_buffer_set_cluster_level"] = wasmExports2["hb_buffer_set_cluster_level"];
        Module["_hb_buffer_get_length"] = wasmExports2["hb_buffer_get_length"];
        Module["_hb_buffer_get_glyph_infos"] = wasmExports2["hb_buffer_get_glyph_infos"];
        Module["_hb_buffer_get_glyph_positions"] = wasmExports2["hb_buffer_get_glyph_positions"];
        Module["_hb_glyph_info_get_glyph_flags"] = wasmExports2["hb_glyph_info_get_glyph_flags"];
        Module["_hb_buffer_guess_segment_properties"] = wasmExports2["hb_buffer_guess_segment_properties"];
        Module["_hb_buffer_add_utf8"] = wasmExports2["hb_buffer_add_utf8"];
        Module["_hb_buffer_add_utf16"] = wasmExports2["hb_buffer_add_utf16"];
        Module["_hb_buffer_set_message_func"] = wasmExports2["hb_buffer_set_message_func"];
        Module["_hb_language_from_string"] = wasmExports2["hb_language_from_string"];
        Module["_hb_script_from_string"] = wasmExports2["hb_script_from_string"];
        Module["_hb_version"] = wasmExports2["hb_version"];
        Module["_hb_version_string"] = wasmExports2["hb_version_string"];
        Module["_hb_feature_from_string"] = wasmExports2["hb_feature_from_string"];
        Module["_malloc"] = wasmExports2["malloc"];
        Module["_free"] = wasmExports2["free"];
        Module["_hb_draw_funcs_set_move_to_func"] = wasmExports2["hb_draw_funcs_set_move_to_func"];
        Module["_hb_draw_funcs_set_line_to_func"] = wasmExports2["hb_draw_funcs_set_line_to_func"];
        Module["_hb_draw_funcs_set_quadratic_to_func"] = wasmExports2["hb_draw_funcs_set_quadratic_to_func"];
        Module["_hb_draw_funcs_set_cubic_to_func"] = wasmExports2["hb_draw_funcs_set_cubic_to_func"];
        Module["_hb_draw_funcs_set_close_path_func"] = wasmExports2["hb_draw_funcs_set_close_path_func"];
        Module["_hb_draw_funcs_create"] = wasmExports2["hb_draw_funcs_create"];
        Module["_hb_draw_funcs_destroy"] = wasmExports2["hb_draw_funcs_destroy"];
        Module["_hb_face_create"] = wasmExports2["hb_face_create"];
        Module["_hb_face_destroy"] = wasmExports2["hb_face_destroy"];
        Module["_hb_face_reference_table"] = wasmExports2["hb_face_reference_table"];
        Module["_hb_face_get_upem"] = wasmExports2["hb_face_get_upem"];
        Module["_hb_face_collect_unicodes"] = wasmExports2["hb_face_collect_unicodes"];
        Module["_hb_font_draw_glyph"] = wasmExports2["hb_font_draw_glyph"];
        Module["_hb_font_glyph_to_string"] = wasmExports2["hb_font_glyph_to_string"];
        Module["_hb_font_create"] = wasmExports2["hb_font_create"];
        Module["_hb_font_set_variations"] = wasmExports2["hb_font_set_variations"];
        Module["_hb_font_destroy"] = wasmExports2["hb_font_destroy"];
        Module["_hb_font_set_scale"] = wasmExports2["hb_font_set_scale"];
        Module["_hb_set_create"] = wasmExports2["hb_set_create"];
        Module["_hb_set_destroy"] = wasmExports2["hb_set_destroy"];
        Module["_hb_ot_var_get_axis_infos"] = wasmExports2["hb_ot_var_get_axis_infos"];
        Module["_hb_set_get_population"] = wasmExports2["hb_set_get_population"];
        Module["_hb_set_next_many"] = wasmExports2["hb_set_next_many"];
        Module["_hb_shape"] = wasmExports2["hb_shape"];
        __emscripten_timeout = wasmExports2["_emscripten_timeout"];
      }
      var wasmImports = { _abort_js: __abort_js, _emscripten_runtime_keepalive_clear: __emscripten_runtime_keepalive_clear, _setitimer_js: __setitimer_js, emscripten_resize_heap: _emscripten_resize_heap, proc_exit: _proc_exit };
      var wasmExports = await createWasm();
      function run() {
        if (runDependencies > 0) {
          dependenciesFulfilled = run;
          return;
        }
        preRun();
        if (runDependencies > 0) {
          dependenciesFulfilled = run;
          return;
        }
        function doRun() {
          Module["calledRun"] = true;
          if (ABORT)
            return;
          initRuntime();
          readyPromiseResolve?.(Module);
          Module["onRuntimeInitialized"]?.();
          postRun();
        }
        if (Module["setStatus"]) {
          Module["setStatus"]("Running...");
          setTimeout(() => {
            setTimeout(() => Module["setStatus"](""), 1);
            doRun();
          }, 1);
        } else {
          doRun();
        }
      }
      function preInit() {
        if (Module["preInit"]) {
          if (typeof Module["preInit"] == "function")
            Module["preInit"] = [Module["preInit"]];
          while (Module["preInit"].length > 0) {
            Module["preInit"].shift()();
          }
        }
      }
      preInit();
      run();
      if (runtimeInitialized) {
        moduleRtn = Module;
      } else {
        moduleRtn = new Promise((resolve, reject) => {
          readyPromiseResolve = resolve;
          readyPromiseReject = reject;
        });
      }
      return moduleRtn;
    };
  })();
  {
    module.exports = createHarfBuzz;
    module.exports.default = createHarfBuzz;
  }
})(hb);
var hbExports = hb.exports;
var createHarfBuzz = /* @__PURE__ */ getDefaultExportFromCjs(hbExports);
var hbjs$2 = { exports: {} };
function hbjs(Module) {
  var exports = Module.wasmExports;
  var utf8Decoder = new TextDecoder("utf8");
  let addFunction = Module.addFunction;
  let removeFunction = Module.removeFunction;
  var freeFuncPtr = addFunction(function(ptr) {
    exports.free(ptr);
  }, "vi");
  var HB_MEMORY_MODE_WRITABLE = 2;
  var HB_SET_VALUE_INVALID = -1;
  var HB_BUFFER_CONTENT_TYPE_GLYPHS = 2;
  var DONT_STOP = 0;
  var GSUB_PHASE = 1;
  var GPOS_PHASE = 2;
  function hb_tag(s) {
    return (s.charCodeAt(0) & 255) << 24 | (s.charCodeAt(1) & 255) << 16 | (s.charCodeAt(2) & 255) << 8 | (s.charCodeAt(3) & 255) << 0;
  }
  var HB_BUFFER_SERIALIZE_FORMAT_JSON = hb_tag("JSON");
  var HB_BUFFER_SERIALIZE_FLAG_NO_GLYPH_NAMES = 4;
  function _hb_untag(tag) {
    return [
      String.fromCharCode(tag >> 24 & 255),
      String.fromCharCode(tag >> 16 & 255),
      String.fromCharCode(tag >> 8 & 255),
      String.fromCharCode(tag >> 0 & 255)
    ].join("");
  }
  function _buffer_flag(s) {
    if (s == "BOT") {
      return 1;
    }
    if (s == "EOT") {
      return 2;
    }
    if (s == "PRESERVE_DEFAULT_IGNORABLES") {
      return 4;
    }
    if (s == "REMOVE_DEFAULT_IGNORABLES") {
      return 8;
    }
    if (s == "DO_NOT_INSERT_DOTTED_CIRCLE") {
      return 16;
    }
    if (s == "PRODUCE_UNSAFE_TO_CONCAT") {
      return 64;
    }
    return 0;
  }
  function createBlob(blob) {
    var blobPtr = exports.malloc(blob.byteLength);
    Module.HEAPU8.set(new Uint8Array(blob), blobPtr);
    var ptr = exports.hb_blob_create(blobPtr, blob.byteLength, HB_MEMORY_MODE_WRITABLE, blobPtr, freeFuncPtr);
    return {
      ptr,
      destroy: function() {
        exports.hb_blob_destroy(ptr);
      }
    };
  }
  function typedArrayFromSet(setPtr) {
    const setCount = exports.hb_set_get_population(setPtr);
    const arrayPtr = exports.malloc(setCount << 2);
    const arrayOffset = arrayPtr >> 2;
    const array = Module.HEAPU32.subarray(arrayOffset, arrayOffset + setCount);
    Module.HEAPU32.set(array, arrayOffset);
    exports.hb_set_next_many(setPtr, HB_SET_VALUE_INVALID, arrayPtr, setCount);
    return array;
  }
  function createFace(blob, index) {
    var ptr = exports.hb_face_create(blob.ptr, index);
    const upem = exports.hb_face_get_upem(ptr);
    return {
      ptr,
      upem,
      reference_table: function(table) {
        var blob2 = exports.hb_face_reference_table(ptr, hb_tag(table));
        var length = exports.hb_blob_get_length(blob2);
        if (!length) {
          return;
        }
        var blobptr = exports.hb_blob_get_data(blob2, null);
        var table_string = Module.HEAPU8.subarray(blobptr, blobptr + length);
        return table_string;
      },
      getAxisInfos: function() {
        var axis = exports.malloc(2048);
        var c = exports.malloc(4);
        Module.HEAPU32[c / 4] = 64;
        exports.hb_ot_var_get_axis_infos(ptr, 0, c, axis);
        var result = {};
        Array.from({ length: Module.HEAPU32[c / 4] }).forEach(function(_, i) {
          result[_hb_untag(Module.HEAPU32[axis / 4 + i * 8 + 1])] = {
            min: Module.HEAPF32[axis / 4 + i * 8 + 4],
            default: Module.HEAPF32[axis / 4 + i * 8 + 5],
            max: Module.HEAPF32[axis / 4 + i * 8 + 6]
          };
        });
        exports.free(c);
        exports.free(axis);
        return result;
      },
      collectUnicodes: function() {
        var unicodeSetPtr = exports.hb_set_create();
        exports.hb_face_collect_unicodes(ptr, unicodeSetPtr);
        var result = typedArrayFromSet(unicodeSetPtr);
        exports.hb_set_destroy(unicodeSetPtr);
        return result;
      },
      destroy: function() {
        exports.hb_face_destroy(ptr);
      }
    };
  }
  var pathBuffer = "";
  var nameBufferSize = 256;
  var nameBuffer = exports.malloc(nameBufferSize);
  function createFont(face) {
    var ptr = exports.hb_font_create(face.ptr);
    var drawFuncsPtr = null;
    var moveToPtr = null;
    var lineToPtr = null;
    var cubicToPtr = null;
    var quadToPtr = null;
    var closePathPtr = null;
    function glyphToPath(glyphId) {
      if (!drawFuncsPtr) {
        var moveTo = function(dfuncs, draw_data, draw_state, to_x, to_y, user_data) {
          pathBuffer += `M${to_x},${to_y}`;
        };
        var lineTo = function(dfuncs, draw_data, draw_state, to_x, to_y, user_data) {
          pathBuffer += `L${to_x},${to_y}`;
        };
        var cubicTo = function(dfuncs, draw_data, draw_state, c1_x, c1_y, c2_x, c2_y, to_x, to_y, user_data) {
          pathBuffer += `C${c1_x},${c1_y} ${c2_x},${c2_y} ${to_x},${to_y}`;
        };
        var quadTo = function(dfuncs, draw_data, draw_state, c_x, c_y, to_x, to_y, user_data) {
          pathBuffer += `Q${c_x},${c_y} ${to_x},${to_y}`;
        };
        var closePath = function(dfuncs, draw_data, draw_state, user_data) {
          pathBuffer += "Z";
        };
        moveToPtr = addFunction(moveTo, "viiiffi");
        lineToPtr = addFunction(lineTo, "viiiffi");
        cubicToPtr = addFunction(cubicTo, "viiiffffffi");
        quadToPtr = addFunction(quadTo, "viiiffffi");
        closePathPtr = addFunction(closePath, "viiii");
        drawFuncsPtr = exports.hb_draw_funcs_create();
        exports.hb_draw_funcs_set_move_to_func(drawFuncsPtr, moveToPtr, 0, 0);
        exports.hb_draw_funcs_set_line_to_func(drawFuncsPtr, lineToPtr, 0, 0);
        exports.hb_draw_funcs_set_cubic_to_func(drawFuncsPtr, cubicToPtr, 0, 0);
        exports.hb_draw_funcs_set_quadratic_to_func(drawFuncsPtr, quadToPtr, 0, 0);
        exports.hb_draw_funcs_set_close_path_func(drawFuncsPtr, closePathPtr, 0, 0);
      }
      pathBuffer = "";
      exports.hb_font_draw_glyph(ptr, glyphId, drawFuncsPtr, 0);
      return pathBuffer;
    }
    function glyphName(glyphId) {
      exports.hb_font_glyph_to_string(ptr, glyphId, nameBuffer, nameBufferSize);
      var array = Module.HEAPU8.subarray(nameBuffer, nameBuffer + nameBufferSize);
      return utf8Decoder.decode(array.slice(0, array.indexOf(0)));
    }
    return {
      ptr,
      glyphName,
      glyphToPath,
      glyphToJson: function(glyphId) {
        var path = glyphToPath(glyphId);
        return path.replace(/([MLQCZ])/g, "|$1 ").split("|").filter(function(x) {
          return x.length;
        }).map(function(x) {
          var row = x.split(/[ ,]/g);
          return { type: row[0], values: row.slice(1).filter(function(x2) {
            return x2.length;
          }).map(function(x2) {
            return +x2;
          }) };
        });
      },
      setScale: function(xScale, yScale) {
        exports.hb_font_set_scale(ptr, xScale, yScale);
      },
      setVariations: function(variations) {
        var entries = Object.entries(variations);
        var vars = exports.malloc(8 * entries.length);
        entries.forEach(function(entry, i) {
          Module.HEAPU32[vars / 4 + i * 2 + 0] = hb_tag(entry[0]);
          Module.HEAPF32[vars / 4 + i * 2 + 1] = entry[1];
        });
        exports.hb_font_set_variations(ptr, vars, entries.length);
        exports.free(vars);
      },
      destroy: function() {
        exports.hb_font_destroy(ptr);
        if (drawFuncsPtr) {
          exports.hb_draw_funcs_destroy(drawFuncsPtr);
          drawFuncsPtr = null;
          removeFunction(moveToPtr);
          removeFunction(lineToPtr);
          removeFunction(cubicToPtr);
          removeFunction(quadToPtr);
          removeFunction(closePathPtr);
        }
      }
    };
  }
  function createAsciiString(text) {
    var ptr = exports.malloc(text.length + 1);
    for (let i = 0;i < text.length; ++i) {
      const char = text.charCodeAt(i);
      if (char > 127)
        throw new Error("Expected ASCII text");
      Module.HEAPU8[ptr + i] = char;
    }
    Module.HEAPU8[ptr + text.length] = 0;
    return {
      ptr,
      length: text.length,
      free: function() {
        exports.free(ptr);
      }
    };
  }
  function createJsString(text) {
    const ptr = exports.malloc(text.length * 2);
    const words = new Uint16Array(Module.wasmMemory.buffer, ptr, text.length);
    for (let i = 0;i < words.length; ++i)
      words[i] = text.charCodeAt(i);
    return {
      ptr,
      length: words.length,
      free: function() {
        exports.free(ptr);
      }
    };
  }
  function createBuffer() {
    var ptr = exports.hb_buffer_create();
    return {
      ptr,
      addText: function(text) {
        const str = createJsString(text);
        exports.hb_buffer_add_utf16(ptr, str.ptr, str.length, 0, str.length);
        str.free();
      },
      guessSegmentProperties: function() {
        return exports.hb_buffer_guess_segment_properties(ptr);
      },
      setDirection: function(dir) {
        exports.hb_buffer_set_direction(ptr, {
          ltr: 4,
          rtl: 5,
          ttb: 6,
          btt: 7
        }[dir] || 0);
      },
      setFlags: function(flags) {
        var flagValue = 0;
        flags.forEach(function(s) {
          flagValue |= _buffer_flag(s);
        });
        exports.hb_buffer_set_flags(ptr, flagValue);
      },
      setLanguage: function(language) {
        var str = createAsciiString(language);
        exports.hb_buffer_set_language(ptr, exports.hb_language_from_string(str.ptr, -1));
        str.free();
      },
      setScript: function(script) {
        var str = createAsciiString(script);
        exports.hb_buffer_set_script(ptr, exports.hb_script_from_string(str.ptr, -1));
        str.free();
      },
      setClusterLevel: function(level) {
        exports.hb_buffer_set_cluster_level(ptr, level);
      },
      json: function() {
        var length = exports.hb_buffer_get_length(ptr);
        var result = [];
        var infosPtr = exports.hb_buffer_get_glyph_infos(ptr, 0);
        var infosPtr32 = infosPtr / 4;
        var positionsPtr32 = exports.hb_buffer_get_glyph_positions(ptr, 0) / 4;
        var infos = Module.HEAPU32.subarray(infosPtr32, infosPtr32 + 5 * length);
        var positions = Module.HEAP32.subarray(positionsPtr32, positionsPtr32 + 5 * length);
        for (var i = 0;i < length; ++i) {
          result.push({
            g: infos[i * 5 + 0],
            cl: infos[i * 5 + 2],
            ax: positions[i * 5 + 0],
            ay: positions[i * 5 + 1],
            dx: positions[i * 5 + 2],
            dy: positions[i * 5 + 3],
            flags: exports.hb_glyph_info_get_glyph_flags(infosPtr + i * 20)
          });
        }
        return result;
      },
      destroy: function() {
        exports.hb_buffer_destroy(ptr);
      }
    };
  }
  function shape(font, buffer, features) {
    var featuresPtr = 0;
    var featuresLen = 0;
    if (features) {
      features = features.split(",");
      featuresPtr = exports.malloc(16 * features.length);
      features.forEach(function(feature, i) {
        var str = createAsciiString(feature);
        if (exports.hb_feature_from_string(str.ptr, -1, featuresPtr + featuresLen * 16))
          featuresLen++;
        str.free();
      });
    }
    exports.hb_shape(font.ptr, buffer.ptr, featuresPtr, featuresLen);
    if (featuresPtr)
      exports.free(featuresPtr);
  }
  function shapeWithTrace(font, buffer, features, stop_at, stop_phase) {
    var trace = [];
    var currentPhase = DONT_STOP;
    var stopping = false;
    var traceBufLen = 1048576;
    var traceBufPtr = exports.malloc(traceBufLen);
    var traceFunc = function(bufferPtr, fontPtr, messagePtr, user_data) {
      var message = utf8Decoder.decode(Module.HEAPU8.subarray(messagePtr, Module.HEAPU8.indexOf(0, messagePtr)));
      if (message.startsWith("start table GSUB"))
        currentPhase = GSUB_PHASE;
      else if (message.startsWith("start table GPOS"))
        currentPhase = GPOS_PHASE;
      if (currentPhase != stop_phase)
        stopping = false;
      if (stop_phase != DONT_STOP && currentPhase == stop_phase && message.startsWith("end lookup " + stop_at))
        stopping = true;
      if (stopping)
        return 0;
      exports.hb_buffer_serialize_glyphs(bufferPtr, 0, exports.hb_buffer_get_length(bufferPtr), traceBufPtr, traceBufLen, 0, fontPtr, HB_BUFFER_SERIALIZE_FORMAT_JSON, HB_BUFFER_SERIALIZE_FLAG_NO_GLYPH_NAMES);
      trace.push({
        m: message,
        t: JSON.parse(utf8Decoder.decode(Module.HEAPU8.subarray(traceBufPtr, Module.HEAPU8.indexOf(0, traceBufPtr)))),
        glyphs: exports.hb_buffer_get_content_type(bufferPtr) == HB_BUFFER_CONTENT_TYPE_GLYPHS
      });
      return 1;
    };
    var traceFuncPtr = addFunction(traceFunc, "iiiii");
    exports.hb_buffer_set_message_func(buffer.ptr, traceFuncPtr, 0, 0);
    shape(font, buffer, features);
    exports.free(traceBufPtr);
    removeFunction(traceFuncPtr);
    return trace;
  }
  function version() {
    var versionPtr = exports.malloc(12);
    exports.hb_version(versionPtr, versionPtr + 4, versionPtr + 8);
    var version2 = {
      major: Module.HEAPU32[versionPtr / 4],
      minor: Module.HEAPU32[(versionPtr + 4) / 4],
      micro: Module.HEAPU32[(versionPtr + 8) / 4]
    };
    exports.free(versionPtr);
    return version2;
  }
  function version_string() {
    var versionPtr = exports.hb_version_string();
    var version2 = utf8Decoder.decode(Module.HEAPU8.subarray(versionPtr, Module.HEAPU8.indexOf(0, versionPtr)));
    return version2;
  }
  return {
    createBlob,
    createFace,
    createFont,
    createBuffer,
    shape,
    shapeWithTrace,
    version,
    version_string
  };
}
try {
  hbjs$2.exports = hbjs;
} catch (e) {}
var hbjsExports = hbjs$2.exports;
var hbjs$1 = /* @__PURE__ */ getDefaultExportFromCjs(hbjsExports);
var harfbuzzPromise = null;
var wasmPath = null;
var wasmBuffer = null;
var HarfBuzzLoader = {
  setWasmPath(path) {
    wasmPath = path;
    wasmBuffer = null;
    harfbuzzPromise = null;
  },
  setWasmBuffer(buffer) {
    wasmBuffer = buffer;
    wasmPath = null;
    harfbuzzPromise = null;
  },
  async getHarfBuzz() {
    if (harfbuzzPromise) {
      return harfbuzzPromise;
    }
    harfbuzzPromise = new Promise(async (resolve, reject) => {
      try {
        const moduleConfig = {};
        if (wasmBuffer) {
          moduleConfig.wasmBinary = wasmBuffer;
        } else if (wasmPath) {
          moduleConfig.wasmBinary = await loadBinary(wasmPath);
        } else {
          throw new Error("HarfBuzz WASM path or buffer must be set before initialization.");
        }
        const hbModule = await createHarfBuzz(moduleConfig);
        const hb2 = hbjs$1(hbModule);
        const module = {
          addFunction: hbModule.addFunction,
          exports: hbModule.wasmExports,
          removeFunction: hbModule.removeFunction
        };
        resolve({ hb: hb2, module });
      } catch (error2) {
        reject(new Error(`Failed to initialize HarfBuzz: ${error2}`));
      }
    });
    return harfbuzzPromise;
  }
};
var DEFAULT_MAX_TEXT_LENGTH = 1e5;
var DEFAULT_FONT_SIZE = 72;

class Text {
  static {
    this.patternCache = new Map;
  }
  static {
    this.hbInitPromise = null;
  }
  static {
    this.fontCache = new Map;
  }
  static {
    this.fontLoadPromises = new Map;
  }
  static {
    this.fontRefCounts = new Map;
  }
  static {
    this.fontCacheMemoryBytes = 0;
  }
  static {
    this.maxFontCacheMemoryBytes = Infinity;
  }
  static {
    this.fontIdCounter = 0;
  }
  static enableWoff2(decoder) {
    setWoff2Decoder(decoder);
  }
  static stableStringify(obj) {
    const keys = Object.keys(obj).sort();
    let result = "";
    for (let i = 0;i < keys.length; i++) {
      if (i > 0)
        result += ",";
      result += keys[i] + ":" + obj[keys[i]];
    }
    return result;
  }
  constructor() {
    this.currentFontId = "";
    if (!Text.hbInitPromise) {
      Text.hbInitPromise = HarfBuzzLoader.getHarfBuzz();
    }
    this.fontLoader = new FontLoader(() => Text.hbInitPromise);
  }
  static setHarfBuzzPath(path) {
    HarfBuzzLoader.setWasmPath(path);
    Text.hbInitPromise = null;
  }
  static setHarfBuzzBuffer(wasmBuffer2) {
    HarfBuzzLoader.setWasmBuffer(wasmBuffer2);
    Text.hbInitPromise = null;
  }
  static init() {
    if (!Text.hbInitPromise) {
      Text.hbInitPromise = HarfBuzzLoader.getHarfBuzz();
    }
    return Text.hbInitPromise;
  }
  static async create(options) {
    if (!options.font) {
      throw new Error("Font is required. Specify options.font as a URL string or ArrayBuffer.");
    }
    if (!Text.hbInitPromise) {
      Text.hbInitPromise = HarfBuzzLoader.getHarfBuzz();
    }
    const { loadedFont, fontKey } = await Text.resolveFont(options);
    const text = new Text;
    text.setLoadedFont(loadedFont, fontKey);
    const result = await text.createLayout(options);
    const update = async (newOptions) => {
      const mergedOptions = { ...options };
      for (const key in newOptions) {
        const value = newOptions[key];
        if (value !== undefined) {
          mergedOptions[key] = value;
        }
      }
      if (newOptions.font !== undefined || newOptions.fontVariations !== undefined || newOptions.fontFeatures !== undefined) {
        const { loadedFont: newLoadedFont, fontKey: newFontKey } = await Text.resolveFont(mergedOptions);
        text.setLoadedFont(newLoadedFont, newFontKey);
        text.resetHelpers();
      }
      options = mergedOptions;
      const newResult = await text.createLayout(options);
      return {
        ...newResult,
        getLoadedFont: () => text.getLoadedFont(),
        measureTextWidth: (textString, letterSpacing) => text.measureTextWidth(textString, letterSpacing),
        update,
        dispose: () => text.destroy()
      };
    };
    return {
      ...result,
      getLoadedFont: () => text.getLoadedFont(),
      measureTextWidth: (textString, letterSpacing) => text.measureTextWidth(textString, letterSpacing),
      update,
      dispose: () => text.destroy()
    };
  }
  static retainFont(fontKey) {
    Text.fontRefCounts.set(fontKey, (Text.fontRefCounts.get(fontKey) ?? 0) + 1);
  }
  static releaseFont(fontKey, loadedFont) {
    const nextCount = (Text.fontRefCounts.get(fontKey) ?? 0) - 1;
    if (nextCount > 0) {
      Text.fontRefCounts.set(fontKey, nextCount);
      return;
    }
    Text.fontRefCounts.delete(fontKey);
    if (!Text.fontCache.has(fontKey)) {
      FontLoader.destroyFont(loadedFont);
    }
  }
  static async resolveFont(options) {
    const baseFontKey = typeof options.font === "string" ? options.font : `buffer-${Text.generateFontContentHash(options.font)}`;
    let fontKey = baseFontKey;
    if (options.fontVariations) {
      fontKey += `_var_${Text.stableStringify(options.fontVariations)}`;
    }
    if (options.fontFeatures) {
      fontKey += `_feat_${Text.stableStringify(options.fontFeatures)}`;
    }
    let loadedFont = Text.fontCache.get(fontKey);
    if (!loadedFont) {
      let loadPromise = Text.fontLoadPromises.get(fontKey);
      if (!loadPromise) {
        loadPromise = Text.loadAndCacheFont(fontKey, options.font, options.fontVariations, options.fontFeatures).finally(() => {
          Text.fontLoadPromises.delete(fontKey);
        });
        Text.fontLoadPromises.set(fontKey, loadPromise);
      }
      loadedFont = await loadPromise;
    }
    Text.retainFont(fontKey);
    return { loadedFont, fontKey };
  }
  static async loadAndCacheFont(fontKey, font, fontVariations, fontFeatures) {
    const tempText = new Text;
    await tempText.loadFont(font, fontVariations, fontFeatures);
    const loadedFont = tempText.getLoadedFont();
    Text.fontCache.set(fontKey, loadedFont);
    Text.trackFontCacheAdd(loadedFont);
    Text.enforceFontCacheMemoryLimit();
    return loadedFont;
  }
  static trackFontCacheAdd(loadedFont) {
    const size = loadedFont._buffer?.byteLength ?? 0;
    Text.fontCacheMemoryBytes += size;
  }
  static trackFontCacheRemove(fontKey) {
    const font = Text.fontCache.get(fontKey);
    if (!font)
      return;
    const size = font._buffer?.byteLength ?? 0;
    Text.fontCacheMemoryBytes -= size;
    if (Text.fontCacheMemoryBytes < 0)
      Text.fontCacheMemoryBytes = 0;
  }
  static enforceFontCacheMemoryLimit() {
    if (Text.maxFontCacheMemoryBytes === Infinity)
      return;
    while (Text.fontCacheMemoryBytes > Text.maxFontCacheMemoryBytes && Text.fontCache.size > 0) {
      const firstKey = Text.fontCache.keys().next().value;
      if (firstKey === undefined)
        break;
      const font = Text.fontCache.get(firstKey);
      Text.trackFontCacheRemove(firstKey);
      Text.fontCache.delete(firstKey);
      if ((Text.fontRefCounts.get(firstKey) ?? 0) <= 0 && font) {
        FontLoader.destroyFont(font);
      }
    }
  }
  static generateFontContentHash(buffer) {
    if (buffer) {
      const view = new Uint8Array(buffer);
      let hash = 2166136261;
      const samplePoints = Math.min(32, view.length);
      const step = Math.floor(view.length / samplePoints);
      for (let i = 0;i < samplePoints; i++) {
        const index = i * step;
        hash ^= view[index];
        hash = Math.imul(hash, 16777619);
      }
      hash ^= view.length;
      hash = Math.imul(hash, 16777619);
      return (hash >>> 0).toString(36);
    } else {
      return `c${++Text.fontIdCounter}`;
    }
  }
  setLoadedFont(loadedFont, fontKey) {
    if (this.loadedFont && this.loadedFont !== loadedFont) {
      this.releaseCurrentFont();
    }
    this.loadedFont = loadedFont;
    this.currentFontCacheKey = fontKey;
    const contentHash = Text.generateFontContentHash(loadedFont._buffer);
    this.currentFontId = `font_${contentHash}`;
    if (loadedFont.fontVariations) {
      this.currentFontId += `_var_${Text.stableStringify(loadedFont.fontVariations)}`;
    }
    if (loadedFont.fontFeatures) {
      this.currentFontId += `_feat_${Text.stableStringify(loadedFont.fontFeatures)}`;
    }
  }
  releaseCurrentFont() {
    if (!this.loadedFont)
      return;
    const currentFont = this.loadedFont;
    const currentFontKey = this.currentFontCacheKey;
    try {
      if (currentFontKey) {
        Text.releaseFont(currentFontKey, currentFont);
      } else {
        FontLoader.destroyFont(currentFont);
      }
    } catch (error2) {
      logger.warn("Error destroying HarfBuzz objects:", error2);
    } finally {
      this.loadedFont = undefined;
      this.currentFontCacheKey = undefined;
      this.textLayout = undefined;
      this.textShaper = undefined;
    }
  }
  async loadFont(fontSrc, fontVariations, fontFeatures) {
    perfLogger.start("Text.loadFont", {
      fontSrc: typeof fontSrc === "string" ? fontSrc : `buffer(${fontSrc.byteLength})`
    });
    if (!Text.hbInitPromise) {
      Text.hbInitPromise = HarfBuzzLoader.getHarfBuzz();
    }
    await Text.hbInitPromise;
    const fontBuffer = typeof fontSrc === "string" ? await loadBinary(fontSrc) : fontSrc;
    try {
      if (this.loadedFont) {
        this.destroy();
      }
      this.loadedFont = await this.fontLoader.loadFont(fontBuffer, fontVariations);
      if (fontFeatures) {
        this.loadedFont.fontFeatures = fontFeatures;
      }
      const contentHash = Text.generateFontContentHash(fontBuffer);
      this.currentFontId = `font_${contentHash}`;
      if (fontVariations) {
        this.currentFontId += `_var_${Text.stableStringify(fontVariations)}`;
      }
      if (fontFeatures) {
        this.currentFontId += `_feat_${Text.stableStringify(fontFeatures)}`;
      }
    } catch (error2) {
      logger.error("Failed to load font:", error2);
      throw error2;
    } finally {
      perfLogger.end("Text.loadFont");
    }
  }
  async createLayout(options) {
    perfLogger.start("Text.createLayout", {
      textLength: options.text.length,
      size: options.size || DEFAULT_FONT_SIZE,
      hasLayout: !!options.layout
    });
    try {
      if (!this.loadedFont) {
        throw new Error("Font not loaded. Use Text.create() with a font option.");
      }
      const updatedOptions = await this.prepareHyphenation(options);
      this.validateOptions(updatedOptions);
      options = updatedOptions;
      this.updateFontVariations(options);
      this.loadedFont.font.setScale(this.loadedFont.upem, this.loadedFont.upem);
      if (!this.textShaper) {
        this.textShaper = new TextShaper(this.loadedFont);
      }
      const layoutData = this.prepareLayout(options);
      const clustersByLine = this.textShaper.shapeLines(layoutData.lines, layoutData.scaledLineHeight, layoutData.letterSpacing, layoutData.align, layoutData.direction, options.color, options.text);
      return {
        clustersByLine,
        layoutData,
        options,
        loadedFont: this.loadedFont,
        fontId: this.currentFontId
      };
    } finally {
      perfLogger.end("Text.createLayout");
    }
  }
  async prepareHyphenation(options) {
    if (options.layout?.hyphenate !== false && options.layout?.width) {
      const language = options.layout?.language || "en-us";
      if (!options.layout?.hyphenationPatterns?.[language]) {
        try {
          if (!Text.patternCache.has(language)) {
            const pattern = await loadPattern(language, options.layout?.patternsPath);
            Text.patternCache.set(language, pattern);
          }
          return {
            ...options,
            layout: {
              ...options.layout,
              hyphenationPatterns: {
                ...options.layout?.hyphenationPatterns,
                [language]: Text.patternCache.get(language)
              }
            }
          };
        } catch (error2) {
          logger.warn(`Failed to load patterns for ${language}: ${error2}`);
          return {
            ...options,
            layout: {
              ...options.layout,
              hyphenate: false
            }
          };
        }
      }
    }
    return options;
  }
  validateOptions(options) {
    if (!options.text) {
      throw new Error("Text content is required");
    }
    const maxLength = options.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH;
    if (options.text.length > maxLength) {
      throw new Error(`Text exceeds ${maxLength} character limit`);
    }
  }
  updateFontVariations(options) {
    if (options.fontVariations && this.loadedFont) {
      if (Text.stableStringify(options.fontVariations) !== Text.stableStringify(this.loadedFont.fontVariations || {})) {
        this.loadedFont.font.setVariations(options.fontVariations);
        this.loadedFont.fontVariations = options.fontVariations;
      }
    }
  }
  prepareLayout(options) {
    if (!this.loadedFont) {
      throw new Error("Font not loaded. Use Text.create() with a font option");
    }
    const { text, size = DEFAULT_FONT_SIZE, depth = 0, lineHeight = 1, letterSpacing = 0, layout = {} } = options;
    const { width, direction = "ltr", align = direction === "rtl" ? "right" : "left", respectExistingBreaks = true, hyphenate = true, language = "en-us", tolerance = DEFAULT_TOLERANCE, pretolerance = DEFAULT_PRETOLERANCE, emergencyStretch = DEFAULT_EMERGENCY_STRETCH, autoEmergencyStretch, hyphenationPatterns, lefthyphenmin, righthyphenmin, linepenalty, adjdemerits, hyphenpenalty, exhyphenpenalty, doublehyphendemerits } = layout;
    const fontUnitsPerPixel = this.loadedFont.upem / size;
    let widthInFontUnits;
    if (width !== undefined) {
      widthInFontUnits = width * fontUnitsPerPixel;
    }
    const rawDepthInFontUnits = depth * fontUnitsPerPixel;
    const minExtrudeDepth = this.loadedFont.upem * 0.000025;
    const depthInFontUnits = rawDepthInFontUnits <= 0 ? 0 : Math.max(rawDepthInFontUnits, minExtrudeDepth);
    if (!this.textLayout) {
      this.textLayout = new TextLayout(this.loadedFont);
    }
    const layoutResult = this.textLayout.computeLines({
      text,
      width: widthInFontUnits,
      align,
      direction,
      hyphenate,
      language,
      respectExistingBreaks,
      tolerance,
      pretolerance,
      emergencyStretch,
      autoEmergencyStretch,
      hyphenationPatterns,
      lefthyphenmin,
      righthyphenmin,
      linepenalty,
      adjdemerits,
      hyphenpenalty,
      exhyphenpenalty,
      doublehyphendemerits,
      letterSpacing
    });
    const metrics = FontMetadataExtractor.getVerticalMetrics(this.loadedFont.metrics);
    const fontLineHeight = metrics.ascender - metrics.descender;
    const scaledLineHeight = fontLineHeight * lineHeight;
    return {
      lines: layoutResult.lines,
      scaledLineHeight,
      letterSpacing,
      align,
      direction,
      depth: depthInFontUnits,
      size,
      pixelsPerFontUnit: 1 / fontUnitsPerPixel
    };
  }
  getFontMetrics() {
    if (!this.loadedFont) {
      throw new Error("Font not loaded. Call loadFont() first");
    }
    return FontMetadataExtractor.getFontMetrics(this.loadedFont.metrics);
  }
  static async preloadPatterns(languages, patternsPath) {
    await Promise.all(languages.map(async (language) => {
      if (!Text.patternCache.has(language)) {
        try {
          const pattern = await loadPattern(language, patternsPath);
          Text.patternCache.set(language, pattern);
        } catch (error2) {
          logger.warn(`Failed to pre-load patterns for ${language}: ${error2}`);
        }
      }
    }));
  }
  static registerPattern(language, pattern) {
    Text.patternCache.set(language, pattern);
  }
  static setMaxFontCacheMemoryMB(limitMB) {
    Text.maxFontCacheMemoryBytes = limitMB === Infinity ? Infinity : Math.max(1, Math.floor(limitMB)) * 1024 * 1024;
    Text.enforceFontCacheMemoryLimit();
  }
  getLoadedFont() {
    return this.loadedFont;
  }
  measureTextWidth(text, letterSpacing = 0) {
    if (!this.loadedFont) {
      throw new Error("Font not loaded. Call loadFont() first");
    }
    return TextMeasurer.measureTextWidth(this.loadedFont, text, letterSpacing);
  }
  resetHelpers() {
    this.textShaper = undefined;
    this.textLayout = undefined;
  }
  destroy() {
    if (!this.loadedFont) {
      return;
    }
    this.releaseCurrentFont();
  }
}

class Cache {
  constructor() {
    this.cache = new Map;
  }
  get(key) {
    return this.cache.get(key);
  }
  has(key) {
    return this.cache.has(key);
  }
  set(key, value) {
    this.cache.set(key, value);
  }
  delete(key) {
    return this.cache.delete(key);
  }
  clear() {
    this.cache.clear();
  }
  get size() {
    return this.cache.size;
  }
  keys() {
    return Array.from(this.cache.keys());
  }
  getStats() {
    return {
      size: this.cache.size
    };
  }
}
function getGlyphCacheKey(fontId, glyphId, depth, removeOverlaps) {
  const roundedDepth = Math.round(depth * 1000) / 1000;
  return `${fontId}_${glyphId}_${roundedDepth}_${removeOverlaps}`;
}
var globalGlyphCache = new Cache;
var globalContourCache = new Cache;
var globalWordCache = new Cache;
var globalClusteringCache = new Cache;
var globalOutlineCache = new Cache;
function t(t2, i) {
  return t2.s === i.s && t2.t === i.t;
}
function i(t2, i2) {
  return i2.s > t2.s || t2.s === i2.s && i2.t >= t2.t;
}
function s(t2, i2) {
  return i2.t > t2.t || t2.t === i2.t && i2.s >= t2.s;
}
function e(t2) {
  return i(t2.h.i, t2.i);
}
function n(t2) {
  return i(t2.i, t2.h.i);
}
function h(t2, i2) {
  return Math.abs(t2.s - i2.s) + Math.abs(t2.t - i2.t);
}
function r(t2, i2, s2) {
  let e2 = i2.s - t2.s, n2 = s2.s - i2.s;
  return e2 + n2 > 0 ? n2 > e2 ? i2.t - t2.t + e2 / (e2 + n2) * (t2.t - s2.t) : i2.t - s2.t + n2 / (e2 + n2) * (s2.t - t2.t) : 0;
}
function l(t2, i2, s2) {
  let e2 = i2.s - t2.s, n2 = s2.s - i2.s;
  return e2 + n2 > 0 ? (i2.t - s2.t) * e2 + (i2.t - t2.t) * n2 : 0;
}
function o(t2, i2, s2) {
  let e2 = i2.t - t2.t, n2 = s2.t - i2.t;
  return e2 + n2 > 0 ? n2 > e2 ? i2.s - t2.s + e2 / (e2 + n2) * (t2.s - s2.s) : i2.s - s2.s + n2 / (e2 + n2) * (s2.s - t2.s) : 0;
}
function u(t2, i2, s2) {
  let e2 = i2.t - t2.t, n2 = s2.t - i2.t;
  return e2 + n2 > 0 ? (i2.s - s2.s) * e2 + (i2.s - t2.s) * n2 : 0;
}
function c(t2, i2, s2, e2) {
  return (t2 = 0 > t2 ? 0 : t2) > (s2 = 0 > s2 ? 0 : s2) ? e2 + s2 / (t2 + s2) * (i2 - e2) : s2 === 0 ? (i2 + e2) / 2 : i2 + t2 / (t2 + s2) * (e2 - i2);
}
function a(t2, s2, e2) {
  const n2 = t2.event, h2 = s2.l, o2 = e2.l;
  return h2.h.i === n2 ? o2.h.i === n2 ? i(h2.i, o2.i) ? 0 >= l(o2.h.i, h2.i, o2.i) : l(h2.h.i, o2.i, h2.i) >= 0 : 0 >= l(o2.h.i, n2, o2.i) : o2.h.i === n2 ? l(h2.h.i, n2, h2.i) >= 0 : r(h2.h.i, n2, h2.i) >= r(o2.h.i, n2, o2.i);
}
function f(t2) {
  return t2.o;
}
function d(t2) {
  return t2.next;
}
function w(t2, i2) {
  t2.u += i2.u, t2.h.u += i2.h.u;
}
function E(t2, i2) {
  i2.l.N = null, t2._.delete(i2);
}
function N(t2, i2, s2) {
  t2.A.delete(i2.l), i2.I = 0, i2.l = s2, s2.N = i2;
}
function _(t2, i2) {
  let s2, e2 = i2.l.i;
  do {
    i2 = d(i2);
  } while (i2.l.i === e2);
  return i2.I && (s2 = t2.A.connect(f(i2).l.h, i2.l.O), N(t2, i2, s2), i2 = d(i2)), i2;
}
function A(t2) {
  let i2 = t2.l.h.i;
  do {
    t2 = d(t2);
  } while (t2.l.h.i === i2);
  return t2;
}
function I(t2, i2, s2) {
  const e2 = new Z;
  return e2.l = s2, t2._.insertBefore(i2, e2), e2.I = 0, e2.k = 0, e2.T = 0, s2.N = e2, e2;
}
function g(t2, i2) {
  switch (t2.M) {
    case Y.ODD:
      return !!(1 & i2);
    case Y.NONZERO:
      return i2 !== 0;
    case Y.POSITIVE:
      return i2 > 0;
    case Y.NEGATIVE:
      return 0 > i2;
    case Y.ABS_GEQ_TWO:
      return i2 >= 2 || -2 >= i2;
  }
  throw Error("Invalid winding rule");
}
function O(t2, i2) {
  const s2 = i2.l, e2 = s2.D;
  e2.p = i2.p, e2.L = s2, E(t2, i2);
}
function k(t2, i2, s2) {
  let e2, n2 = null, h2 = i2, r2 = i2.l;
  for (;h2 !== s2; ) {
    if (h2.I = 0, n2 = f(h2), e2 = n2.l, e2.i != r2.i) {
      if (!n2.I) {
        O(t2, h2);
        break;
      }
      e2 = t2.A.connect(r2.C.h, e2.h), N(t2, n2, e2);
    }
    r2.C !== e2 && (t2.A.splice(e2.h.O, e2), t2.A.splice(r2, e2)), O(t2, h2), r2 = n2.l, h2 = n2;
  }
  return r2;
}
function y(t2, i2, s2, e2, n2, h2) {
  let r2, l2, o2, u2, c2 = 1;
  o2 = s2;
  do {
    I(t2, i2, o2.h), o2 = o2.C;
  } while (o2 !== e2);
  for (n2 === null && (n2 = f(i2).l.h.C), l2 = i2, u2 = n2;r2 = f(l2), o2 = r2.l.h, o2.i === u2.i; )
    o2.C !== u2 && (t2.A.splice(o2.h.O, o2), t2.A.splice(u2.h.O, o2)), r2.G = l2.G - o2.u, r2.p = g(t2, r2.G), l2.T = 1, !c2 && D(t2, l2) && (w(o2, u2), E(t2, l2), t2.A.delete(u2)), c2 = 0, l2 = r2, u2 = o2;
  l2.T = 1, h2 && C(t2, l2);
}
function T(t2, i2, s2, e2, n2) {
  i2.data = null, t2.R && (rt[0] = i2.coords[0], rt[1] = i2.coords[1], rt[2] = i2.coords[2], i2.data = t2.R(rt, s2, e2, t2.m)), i2.data === null && (n2 ? (t2.v(100156), t2.U = 1) : i2.data = s2[0]);
}
function b(t2, i2, s2) {
  t2.R && (ht[0] = i2.i.data, ht[1] = s2.i.data, ht[2] = null, ht[3] = null, nt[0] = 0.5, nt[1] = 0.5, nt[2] = 0, nt[3] = 0, T(t2, i2.i, ht, nt, 0)), t2.A.splice(i2, s2);
}
function M(t2, i2, s2, e2, n2) {
  let r2 = h(i2, t2), l2 = h(s2, t2), o2 = 0.5 * l2 / (r2 + l2), u2 = 0.5 * r2 / (r2 + l2);
  e2 !== undefined && n2 !== undefined && (e2[n2] = o2, e2[n2 + 1] = u2), t2.coords[0] += o2 * i2.coords[0] + u2 * s2.coords[0], t2.coords[1] += o2 * i2.coords[1] + u2 * s2.coords[1], t2.coords[2] += o2 * i2.coords[2] + u2 * s2.coords[2];
}
function D(i2, s2) {
  let e2 = f(s2);
  const n2 = s2.l, h2 = e2.l;
  if (h2.i.s > n2.i.s || n2.i.s === h2.i.s && h2.i.t >= n2.i.t) {
    if (l(h2.h.i, n2.i, h2.i) > 0)
      return 0;
    t(n2.i, h2.i) ? n2.i !== h2.i && (i2.S.delete(n2.i.B), b(i2, h2.h.O, n2)) : (i2.A.V(h2.h), i2.A.splice(n2, h2.h.O), s2.T = e2.T = 1);
  } else {
    if (0 > l(n2.h.i, h2.i, n2.i))
      return 0;
    d(s2).T = s2.T = 1, i2.A.V(n2.h), i2.A.splice(h2.h.O, n2);
  }
  return 1;
}
function p(t2, i2) {
  let s2 = f(i2);
  const e2 = i2.l, n2 = s2.l;
  let h2;
  if (n2.h.i.s > e2.h.i.s || e2.h.i.s === n2.h.i.s && n2.h.i.t >= e2.h.i.t) {
    if (0 > l(e2.h.i, n2.h.i, e2.i))
      return 0;
    d(i2).T = i2.T = 1, h2 = t2.A.V(e2), t2.A.splice(n2.h, h2), h2.D.p = i2.p;
  } else {
    if (l(n2.h.i, e2.h.i, n2.i) > 0)
      return 0;
    i2.T = s2.T = 1, h2 = t2.A.V(n2), t2.A.splice(e2.O, n2.h), h2.h.D.p = i2.p;
  }
  return 1;
}
function L(e2, n2) {
  let h2 = f(n2), a2 = n2.l, w2 = h2.l;
  const E2 = a2.i, N2 = w2.i;
  let I2, g2, O2 = a2.h.i, b2 = w2.h.i;
  const p2 = st || (st = new X);
  let L2, C;
  if (E2 === N2)
    return 0;
  if (I2 = Math.min(E2.t, O2.t), g2 = Math.max(N2.t, b2.t), I2 > g2)
    return 0;
  if (i(E2, N2)) {
    if (l(b2, E2, N2) > 0)
      return 0;
  } else if (0 > l(O2, N2, E2))
    return 0;
  return ((t2, e3, n3, h3, a3) => {
    let f2, d2, w3;
    i(t2, e3) || (w3 = t2, t2 = e3, e3 = w3), i(n3, h3) || (w3 = n3, n3 = h3, h3 = w3), i(t2, n3) || (w3 = t2, t2 = n3, n3 = w3, w3 = e3, e3 = h3, h3 = w3), i(n3, e3) ? i(e3, h3) ? (f2 = r(t2, n3, e3), d2 = r(n3, e3, h3), 0 > f2 + d2 && (f2 = -f2, d2 = -d2), a3.s = c(f2, n3.s, d2, e3.s)) : (f2 = l(t2, n3, e3), d2 = -l(t2, h3, e3), 0 > f2 + d2 && (f2 = -f2, d2 = -d2), a3.s = c(f2, n3.s, d2, h3.s)) : a3.s = 0.5 * (n3.s + e3.s), s(t2, e3) || (w3 = t2, t2 = e3, e3 = w3), s(n3, h3) || (w3 = n3, n3 = h3, h3 = w3), s(t2, n3) || (w3 = t2, t2 = n3, n3 = w3, w3 = e3, e3 = h3, h3 = w3), s(n3, e3) ? s(e3, h3) ? (f2 = o(t2, n3, e3), d2 = o(n3, e3, h3), 0 > f2 + d2 && (f2 = -f2, d2 = -d2), a3.t = c(f2, n3.t, d2, e3.t)) : (f2 = u(t2, n3, e3), d2 = -u(t2, h3, e3), 0 > f2 + d2 && (f2 = -f2, d2 = -d2), a3.t = c(f2, n3.t, d2, h3.t)) : a3.t = 0.5 * (n3.t + e3.t);
  })(O2, E2, b2, N2, p2), (e2.event.s > p2.s || p2.s === e2.event.s && e2.event.t >= p2.t) && (p2.s = e2.event.s, p2.t = e2.event.t), L2 = N2.s > E2.s || E2.s === N2.s && N2.t >= E2.t ? E2 : N2, (p2.s > L2.s || L2.s === p2.s && p2.t >= L2.t) && (p2.s = L2.s, p2.t = L2.t), t(p2, E2) || t(p2, N2) ? (D(e2, n2), 0) : !t(O2, e2.event) && l(O2, e2.event, p2) >= 0 || !t(b2, e2.event) && 0 >= l(b2, e2.event, p2) ? b2 === e2.event ? (e2.A.V(a2.h), e2.A.splice(w2.h, a2), a2 = f(n2 = _(e2, n2)).l, k(e2, f(n2), h2), y(e2, n2, a2.h.O, a2, a2, 1), 1) : O2 === e2.event ? (e2.A.V(w2.h), e2.A.splice(a2.O, w2.h.O), h2 = n2, C = f(n2 = A(n2)).l.h.C, h2.l = w2.h.O, w2 = k(e2, h2, null), y(e2, n2, w2.C, a2.h.C, C, 1), 1) : (0 > l(O2, e2.event, p2) || (d(n2).T = n2.T = 1, e2.A.V(a2.h), a2.i.s = e2.event.s, a2.i.t = e2.event.t), l(b2, e2.event, p2) > 0 || (n2.T = h2.T = 1, e2.A.V(w2.h), w2.i.s = e2.event.s, w2.i.t = e2.event.t), 0) : (e2.A.V(a2.h), e2.A.V(w2.h), e2.A.splice(w2.h.O, a2), a2.i.s = p2.s, a2.i.t = p2.t, a2.i.B = e2.S.P(a2.i), ((t2, i2, s2, e3, n3, h3) => {
    nt[0] = 0, nt[1] = 0, nt[2] = 0, nt[3] = 0, ht[0] = s2.data, ht[1] = e3.data, ht[2] = n3.data, ht[3] = h3.data, i2.coords[0] = i2.coords[1] = i2.coords[2] = 0, M(i2, s2, e3, nt, 0), M(i2, n3, h3, nt, 2), T(t2, i2, ht, nt, 1);
  })(e2, a2.i, E2, O2, N2, b2), d(n2).T = n2.T = h2.T = 1, 0);
}
function C(t2, i2) {
  let s2, e2, n2 = f(i2);
  for (;; ) {
    for (;n2.T; )
      i2 = n2, n2 = f(n2);
    if (!i2.T && (n2 = i2, (i2 = d(i2)) === null || !i2.T))
      return;
    if (i2.T = 0, s2 = i2.l, e2 = n2.l, s2.h.i !== e2.h.i && p(t2, i2) && (n2.I ? (E(t2, n2), t2.A.delete(e2), n2 = f(i2), e2 = n2.l) : i2.I && (E(t2, i2), t2.A.delete(s2), s2 = (i2 = d(n2)).l)), s2.i !== e2.i) {
      if (s2.h.i === e2.h.i || i2.I || n2.I || s2.h.i !== t2.event && e2.h.i !== t2.event)
        D(t2, i2);
      else if (L(t2, i2))
        return;
    }
    s2.i === e2.i && s2.h.i === e2.h.i && (w(e2, s2), E(t2, i2), t2.A.delete(s2), i2 = d(n2));
  }
}
function G(s2, n2) {
  let h2, r2, o2, u2, c2, a2;
  const w2 = et || (et = new Z);
  w2.l = n2.L.h, h2 = s2._.search(w2), r2 = f(h2), r2 && (u2 = h2.l, c2 = r2.l, l(u2.h.i, n2, u2.i) !== 0 ? (o2 = i(c2.h.i, u2.h.i) ? h2 : r2, h2.p || o2.I ? (a2 = o2 === h2 ? s2.A.connect(n2.L.h, u2.O) : s2.A.connect(c2.h.C.h, n2.L).h, o2.I ? N(s2, o2, a2) : ((t2, i2) => {
    i2.G = d(i2).G + i2.l.u, i2.p = g(t2, i2.G);
  })(s2, I(s2, h2, a2)), R(s2, n2)) : y(s2, h2, n2.L, n2.L, null, 1)) : ((i2, s3, n3) => {
    let h3, r3, l2, o3, u3;
    if (h3 = s3.l, t(h3.i, n3))
      b(i2, h3, n3.L);
    else {
      if (!t(h3.h.i, n3))
        return i2.A.V(h3.h), s3.I && (i2.A.delete(h3.C), s3.I = 0), i2.A.splice(n3.L, h3), void R(i2, n3);
      u3 = f(s3 = A(s3)), l2 = u3.l.h, r3 = o3 = l2.C, u3.I && (E(i2, u3), i2.A.delete(l2), l2 = r3.h.O), i2.A.splice(n3.L, l2), e(r3) || (r3 = null), y(i2, s3, l2.C, o3, r3, 1);
    }
  })(s2, h2, n2));
}
function R(s2, e2) {
  s2.event = e2;
  let n2 = e2.L;
  for (;n2.N === null; )
    if (n2 = n2.C, n2 === e2.L)
      return void G(s2, e2);
  let h2 = _(s2, n2.N), r2 = f(h2);
  const l2 = r2.l;
  let o2 = k(s2, r2, null);
  o2.C === l2 ? ((s3, e3, n3) => {
    let h3, r3 = n3.C, l3 = f(e3), o3 = e3.l, u2 = l3.l, c2 = 0;
    o3.h.i !== u2.h.i && L(s3, e3), t(o3.i, s3.event) && (s3.A.splice(r3.h.O, o3), r3 = f(e3 = _(s3, e3)).l, k(s3, f(e3), l3), c2 = 1), t(u2.i, s3.event) && (s3.A.splice(n3, u2.h.O), n3 = k(s3, l3, null), c2 = 1), c2 ? y(s3, e3, n3.C, r3, r3, 1) : (h3 = i(u2.i, o3.i) ? u2.h.O : o3, h3 = s3.A.connect(n3.C.h, h3), y(s3, e3, h3, h3.C, h3.C, 0), h3.h.N.I = 1, C(s3, e3));
  })(s2, h2, o2) : y(s2, h2, o2.C, l2, l2, 1);
}
function m(t2, i2, s2, e2) {
  const n2 = new Z;
  let h2 = t2.A.F();
  h2.i.s = s2, h2.i.t = e2, h2.h.i.s = i2, h2.h.i.t = e2, t2.event = h2.h.i, n2.l = h2, n2.G = 0, n2.p = 0, n2.I = 0, n2.k = 1, n2.T = 0, t2._.P(n2);
}
function v(t2, i2) {
  const s2 = t2.Y;
  let e2 = s2.next, n2 = e2.coords[0], h2 = e2.coords[1], r2 = e2.coords[2], l2 = n2, o2 = h2, u2 = r2, c2 = e2, a2 = e2, f2 = e2, d2 = e2, w2 = e2, E2 = e2;
  for (e2 = s2.next;e2 !== s2; e2 = e2.next) {
    const t3 = e2.coords[0], i3 = e2.coords[1], s3 = e2.coords[2];
    n2 > t3 && (n2 = t3, c2 = e2), t3 > l2 && (l2 = t3, d2 = e2), h2 > i3 && (h2 = i3, a2 = e2), i3 > o2 && (o2 = i3, w2 = e2), r2 > s3 && (r2 = s3, f2 = e2), s3 > u2 && (u2 = s3, E2 = e2);
  }
  let N2 = 0, _2 = l2 - n2;
  const A2 = o2 - h2;
  let I2, g2;
  if (A2 > _2 && (N2 = 1, _2 = A2), u2 - r2 > _2 && (N2 = 2), N2 === 0) {
    if (n2 >= l2)
      return i2[0] = 0, i2[1] = 0, void (i2[2] = 1);
    I2 = c2, g2 = d2;
  } else if (N2 === 1) {
    if (h2 >= o2)
      return i2[0] = 0, i2[1] = 0, void (i2[2] = 1);
    I2 = a2, g2 = w2;
  } else {
    if (r2 >= u2)
      return i2[0] = 0, i2[1] = 0, void (i2[2] = 1);
    I2 = f2, g2 = E2;
  }
  const O2 = I2.coords[0] - g2.coords[0], k2 = I2.coords[1] - g2.coords[1], y2 = I2.coords[2] - g2.coords[2];
  let T2 = 0;
  for (e2 = s2.next;e2 !== s2; e2 = e2.next) {
    const t3 = e2.coords[0] - g2.coords[0], s3 = e2.coords[1] - g2.coords[1], n3 = e2.coords[2] - g2.coords[2], h3 = k2 * n3 - y2 * s3, r3 = y2 * t3 - O2 * n3, l3 = O2 * s3 - k2 * t3, o3 = h3 * h3 + r3 * r3 + l3 * l3;
    o3 > T2 && (T2 = o3, i2[0] = h3, i2[1] = r3, i2[2] = l3);
  }
  T2 > 0 || (i2[0] = i2[1] = i2[2] = 0, Math.abs(k2) > Math.abs(O2) ? i2[Math.abs(y2) > Math.abs(k2) ? 2 : 1] = 1 : i2[Math.abs(y2) > Math.abs(O2) ? 2 : 0] = 1);
}
function x(t2, i2) {
  let s2, e2, n2, h2 = t2.j, r2 = t2.Y, l2 = 0;
  for (s2 = h2.next;s2 !== h2; s2 = s2.next)
    if (n2 = s2.L, n2.u > 0)
      do {
        l2 += (n2.i.s - n2.h.i.s) * (n2.i.t + n2.h.i.t), n2 = n2.O;
      } while (n2 !== s2.L);
  if (0 > l2) {
    for (e2 = r2.next;e2 !== r2; e2 = e2.next)
      e2.t = -e2.t;
    i2[0] = -i2[0], i2[1] = -i2[1], i2[2] = -i2[2];
  }
}
function U(t2, i2) {
  let s2 = 0;
  for (let e2 = i2.j.next;e2 !== i2.j; e2 = e2.next)
    e2.p && (s2 || (t2.H(4), s2 = 1), B(e2, t2));
  s2 && t2.q();
}
function S(t2, i2, s2, e2) {
  0 > i2.s * (s2.t - e2.t) + s2.s * (e2.t - i2.t) + e2.s * (i2.t - s2.t) ? (t2.W(i2.data), t2.W(e2.data), t2.W(s2.data)) : (t2.W(i2.data), t2.W(s2.data), t2.W(e2.data));
}
function B(t2, s2) {
  let e2 = 0, n2 = t2.L;
  do {
    ot[e2++] = n2.i, n2 = n2.O;
  } while (n2 !== t2.L);
  if (3 > e2)
    return;
  if (e2 === 3)
    return void S(s2, ot[0], ot[1], ot[2]);
  ((t3) => {
    if (t3 > ut.length) {
      const i2 = 2 * t3;
      ut = new Int8Array(i2), ct = new Int32Array(i2), at = new Int32Array(i2);
    }
  })(e2);
  let h2 = 0, r2 = 0;
  for (let t3 = 1;e2 > t3; t3++)
    i(ot[t3], ot[h2]) || (h2 = t3), i(ot[t3], ot[r2]) && (r2 = t3);
  if (h2 === r2)
    return;
  let l2 = 0;
  ct[l2] = h2, ut[l2] = 1, l2++;
  let o2 = (h2 + 1) % e2, u2 = (h2 + e2 - 1) % e2;
  for (;o2 !== r2 || u2 !== r2; ) {
    let t3;
    t3 = o2 === r2 ? 0 : u2 === r2 ? 1 : !i(ot[o2], ot[u2]), t3 ? (ct[l2] = o2, ut[l2] = 1, l2++, o2 = (o2 + 1) % e2) : (ct[l2] = u2, ut[l2] = 0, l2++, u2 = (u2 + e2 - 1) % e2);
  }
  ct[l2] = r2, ut[l2] = 1, l2++;
  let c2 = 0;
  at[c2++] = 0, at[c2++] = 1;
  for (let t3 = 2;l2 - 1 > t3; t3++)
    if (ut[t3] !== ut[at[c2 - 1]]) {
      for (;c2 > 1; ) {
        const i2 = at[--c2];
        S(s2, ot[ct[t3]], ot[ct[i2]], ot[ct[at[c2 - 1]]]);
      }
      --c2, at[c2++] = t3 - 1, at[c2++] = t3;
    } else {
      let i2 = at[--c2];
      for (;c2 > 0; ) {
        const e3 = ot[ct[t3]], n3 = ot[ct[i2]], h3 = ot[ct[at[c2 - 1]]], r3 = e3.s * (n3.t - h3.t) + n3.s * (h3.t - e3.t) + h3.s * (e3.t - n3.t);
        if (!(ut[t3] === 1 ? 0 >= r3 : r3 >= 0))
          break;
        S(s2, e3, n3, h3), i2 = at[--c2];
      }
      at[c2++] = i2, at[c2++] = t3;
    }
  for (;c2 > 1; ) {
    const t3 = at[--c2];
    S(s2, ot[ct[l2 - 1]], ot[ct[t3]], ot[ct[at[c2 - 1]]]);
  }
}
function V(t2, i2) {
  let s2;
  for (let e2 = t2.Z.next;e2 !== t2.Z; e2 = s2)
    s2 = e2.next, e2.h.D.p !== e2.D.p ? e2.u = e2.D.p ? i2 : -i2 : t2.delete(e2);
}
function P(t2, i2) {
  let s2 = 0, e2 = -1;
  for (let n2 = i2.j.o;n2 !== i2.j; n2 = n2.o) {
    if (!n2.p)
      continue;
    s2 || (t2.H(4), s2 = 1);
    let i3 = n2.L;
    do {
      {
        const s3 = i3.h && i3.h.D && i3.h.D.p ? 0 : 1;
        e2 !== s3 && (e2 = s3, t2.K(!!e2));
      }
      t2.W(i3.i.data), i3 = i3.O;
    } while (i3 !== n2.L);
  }
  s2 && t2.q();
}
function F(t2, i2) {
  for (let s2 = i2.j.next;s2 !== i2.j; s2 = s2.next) {
    if (!s2.p)
      continue;
    t2.H(2);
    let i3 = s2.L;
    do {
      t2.W(i3.i.data), i3 = i3.O;
    } while (i3 !== s2.L);
    t2.q();
  }
}
var Y;
var j;
var H;
var z;
((t2) => {
  t2[t2.ODD = 0] = "ODD", t2[t2.NONZERO = 1] = "NONZERO", t2[t2.POSITIVE = 2] = "POSITIVE", t2[t2.NEGATIVE = 3] = "NEGATIVE", t2[t2.ABS_GEQ_TWO = 4] = "ABS_GEQ_TWO";
})(Y || (Y = {})), ((t2) => {
  t2[t2.X = 0] = "POLYGONS", t2[t2.J = 1] = "CONNECTED_POLYGONS", t2[t2.$ = 2] = "BOUNDARY_CONTOURS";
})(j || (j = {})), ((t2) => {
  t2[t2.BEGIN = 100100] = "BEGIN", t2[t2.EDGE_FLAG = 100104] = "EDGE_FLAG", t2[t2.VERTEX = 100101] = "VERTEX", t2[t2.END = 100102] = "END", t2[t2.ERROR = 100103] = "ERROR", t2[t2.COMBINE = 100105] = "COMBINE", t2[t2.BEGIN_DATA = 100106] = "BEGIN_DATA", t2[t2.EDGE_FLAG_DATA = 100110] = "EDGE_FLAG_DATA", t2[t2.VERTEX_DATA = 100107] = "VERTEX_DATA", t2[t2.END_DATA = 100108] = "END_DATA", t2[t2.ERROR_DATA = 100109] = "ERROR_DATA", t2[t2.COMBINE_DATA = 100111] = "COMBINE_DATA", t2[t2.WINDING_RULE = 100140] = "WINDING_RULE", t2[t2.BOUNDARY_ONLY = 100141] = "BOUNDARY_ONLY", t2[t2.TOLERANCE = 100142] = "TOLERANCE";
})(H || (H = {})), ((t2) => {
  t2[t2.tt = 100151] = "MISSING_BEGIN_POLYGON", t2[t2.it = 100152] = "MISSING_BEGIN_CONTOUR", t2[t2.st = 100153] = "MISSING_END_POLYGON", t2[t2.et = 100154] = "MISSING_END_CONTOUR", t2[t2.nt = 100155] = "COORD_TOO_LARGE", t2[t2.ht = 100156] = "NEED_COMBINE_CALLBACK";
})(z || (z = {}));

class Z {
  next;
  o;
  l = null;
  G = 0;
  p = 0;
  k = 0;
  T = 0;
  I = 0;
}

class K {
  next;
  i;
  h;
  C;
  O;
  D;
  N = null;
  u = 0;
}

class X {
  next;
  o;
  L;
  coords = [0, 0, 0];
  s = 0;
  t = 0;
  B = 0;
  data = null;
}

class Q {
  next;
  o;
  L;
  p = 0;
}

class J {
  Y;
  j;
  Z;
  rt;
  vertexCount = 0;
  constructor() {
    const t2 = new X, i2 = new Q, s2 = new K, e2 = new K;
    t2.next = t2.o = t2, i2.next = i2.o = i2, s2.next = s2, s2.h = e2, e2.next = e2, e2.h = s2, this.Y = t2, this.j = i2, this.Z = s2, this.rt = e2;
  }
  lt(t2) {
    const i2 = new K, s2 = new K, e2 = t2.h.next;
    return s2.next = e2, e2.h.next = i2, i2.next = t2, t2.h.next = s2, i2.h = s2, i2.C = i2, i2.O = s2, i2.u = 0, i2.N = null, s2.h = i2, s2.C = s2, s2.O = i2, s2.u = 0, s2.N = null, i2;
  }
  ot(t2, i2) {
    const s2 = t2.C, e2 = i2.C;
    s2.h.O = i2, e2.h.O = t2, t2.C = e2, i2.C = s2;
  }
  ut(t2, i2, s2) {
    const e2 = t2, n2 = s2.o;
    e2.o = n2, n2.next = e2, e2.next = s2, s2.o = e2, e2.L = i2, ++this.vertexCount;
    let h2 = i2;
    do {
      h2.i = e2, h2 = h2.C;
    } while (h2 !== i2);
  }
  ct(t2, i2, s2) {
    const e2 = t2, n2 = s2.o;
    e2.o = n2, n2.next = e2, e2.next = s2, s2.o = e2, e2.L = i2, e2.p = s2.p;
    let h2 = i2;
    do {
      h2.D = e2, h2 = h2.O;
    } while (h2 !== i2);
  }
  ft(t2) {
    const i2 = t2.next, s2 = t2.h.next;
    i2.h.next = s2, s2.h.next = i2;
  }
  dt(t2, i2) {
    const s2 = t2.L;
    let e2 = s2;
    do {
      e2.i = i2, e2 = e2.C;
    } while (e2 !== s2);
    const { o: n2, next: h2 } = t2;
    h2.o = n2, n2.next = h2, --this.vertexCount;
  }
  wt(t2, i2) {
    const s2 = t2.L;
    let e2 = s2;
    do {
      e2.D = i2, e2 = e2.O;
    } while (e2 !== s2);
    const { o: n2, next: h2 } = t2;
    h2.o = n2, n2.next = h2;
  }
  F() {
    const t2 = new X, i2 = new X, s2 = new Q, e2 = this.lt(this.Z);
    return this.ut(t2, e2, this.Y), this.ut(i2, e2.h, this.Y), this.ct(s2, e2, this.j), e2;
  }
  splice(t2, i2) {
    let s2 = 0, e2 = 0;
    if (t2 !== i2) {
      if (i2.i !== t2.i && (e2 = 1, this.dt(i2.i, t2.i)), i2.D !== t2.D && (s2 = 1, this.wt(i2.D, t2.D)), this.ot(i2, t2), !e2) {
        const s3 = new X;
        this.ut(s3, i2, t2.i), t2.i.L = t2;
      }
      if (!s2) {
        const s3 = new Q;
        this.ct(s3, i2, t2.D), t2.D.L = t2;
      }
    }
  }
  delete(t2) {
    const i2 = t2.h;
    let s2 = 0;
    if (t2.D !== t2.h.D && (s2 = 1, this.wt(t2.D, t2.h.D)), t2.C === t2)
      this.dt(t2.i, null);
    else if (t2.h.D.L = t2.h.O, t2.i.L = t2.C, this.ot(t2, t2.h.O), !s2) {
      const i3 = new Q;
      this.ct(i3, t2, t2.D);
    }
    i2.C === i2 ? (this.dt(i2.i, null), this.wt(i2.D, null)) : (t2.D.L = i2.h.O, i2.i.L = i2.C, this.ot(i2, i2.h.O)), this.ft(t2);
  }
  Et(t2) {
    const i2 = this.lt(t2), s2 = i2.h;
    this.ot(i2, t2.O), i2.i = t2.h.i;
    const e2 = new X;
    return this.ut(e2, s2, i2.i), i2.D = s2.D = t2.D, i2;
  }
  V(t2) {
    const i2 = this.Et(t2).h;
    return this.ot(t2.h, t2.h.h.O), this.ot(t2.h, i2), t2.h.i = i2.i, i2.h.i.L = i2.h, i2.h.D = t2.h.D, i2.u = t2.u, i2.h.u = t2.h.u, i2;
  }
  connect(t2, i2) {
    let s2 = 0;
    const e2 = this.lt(t2), n2 = e2.h;
    if (i2.D !== t2.D && (s2 = 1, this.wt(i2.D, t2.D)), this.ot(e2, t2.O), this.ot(n2, i2), e2.i = t2.h.i, n2.i = i2.i, e2.D = n2.D = t2.D, t2.D.L = n2, !s2) {
      const i3 = new Q;
      this.ct(i3, e2, t2.D);
    }
    return e2;
  }
  Nt(t2) {
    const i2 = t2.L;
    let s2, e2, n2, h2, r2;
    e2 = i2.O;
    do {
      s2 = e2, e2 = s2.O, s2.D = null, s2.h.D || (s2.C === s2 ? this.dt(s2.i, null) : (s2.i.L = s2.C, this.ot(s2, s2.h.O)), n2 = s2.h, n2.C === n2 ? this.dt(n2.i, null) : (n2.i.L = n2.C, this.ot(n2, n2.h.O)), this.ft(s2));
    } while (s2 != i2);
    h2 = t2.o, r2 = t2.next, r2.o = h2, h2.next = r2;
  }
  _t(t2) {
    let i2 = t2.L, s2 = 0;
    do {
      s2++, i2 = i2.O;
    } while (i2 !== t2.L);
    return s2;
  }
  check() {}
}

class $ {
  max = 0;
  At;
  It;
  gt;
  Ot = 0;
  kt = 0;
  size = 0;
  constructor(t2) {
    this.max = t2, this.At = new Int32Array(t2 + 1), this.It = Array(t2 + 1).fill(null), this.gt = new Int32Array(t2 + 1), this.Ot = 0, this.At[1] = 1, this.It[1] = null;
  }
  reset(t2) {
    if (t2 + 1 > this.max)
      this.max = t2, this.At = new Int32Array(t2 + 1), this.It = Array(t2 + 1).fill(null), this.gt = new Int32Array(t2 + 1);
    else {
      const t3 = this.It;
      for (let i2 = 1;this.size >= i2; i2++)
        t3[i2] = null;
    }
    this.size = 0, this.kt = 0, this.Ot = 0, this.At[1] = 1, this.It[1] = null;
  }
  yt(t2) {
    const i2 = this.At, s2 = this.It, e2 = this.gt;
    let n2 = i2[t2];
    for (;; ) {
      let h2 = t2 << 1;
      if (h2 > this.size)
        break;
      let r2 = h2, l2 = i2[h2];
      if (this.size >= h2 + 1) {
        const t3 = i2[h2 + 1], e3 = s2[t3], n3 = s2[l2];
        (n3.s > e3.s || e3.s === n3.s && n3.t >= e3.t) && (r2 = h2 + 1, l2 = t3);
      }
      const o2 = s2[n2], u2 = s2[l2];
      if (u2.s > o2.s || o2.s === u2.s && u2.t >= o2.t)
        break;
      i2[t2] = l2, e2[l2] = t2, t2 = r2;
    }
    i2[t2] = n2, e2[n2] = t2;
  }
  Tt(t2) {
    const i2 = this.At, s2 = this.It, e2 = this.gt;
    let n2 = i2[t2];
    for (;; ) {
      const h2 = t2 >> 1;
      if (h2 === 0)
        break;
      const r2 = i2[h2], l2 = s2[r2], o2 = s2[n2];
      if (o2.s > l2.s || l2.s === o2.s && o2.t >= l2.t)
        break;
      i2[t2] = r2, e2[r2] = t2, t2 = h2;
    }
    i2[t2] = n2, e2[n2] = t2;
  }
  init() {
    for (let t2 = this.size >> 1;t2 >= 1; --t2)
      this.yt(t2);
    this.Ot = 1;
  }
  bt() {
    return this.size === 0;
  }
  min() {
    return this.size === 0 ? null : this.It[this.At[1]];
  }
  P(t2) {
    let i2, s2;
    if (i2 = ++this.size, 2 * i2 > this.max) {
      this.max *= 2;
      const t3 = new Int32Array(this.max + 1), i3 = new Int32Array(this.max + 1), s3 = Array(this.max + 1).fill(null);
      t3.set(this.At), i3.set(this.gt);
      for (let t4 = 0;this.It.length > t4; t4++)
        s3[t4] = this.It[t4];
      this.At = t3, this.gt = i3, this.It = s3;
    }
    return this.kt === 0 ? s2 = i2 : (s2 = this.kt, this.kt = this.gt[s2]), this.At[i2] = s2, this.gt[s2] = i2, this.It[s2] = t2, this.Ot && this.Tt(i2), s2;
  }
  Mt() {
    const t2 = this.At, i2 = this.It, s2 = this.gt;
    let e2 = t2[1], n2 = i2[e2];
    return this.size > 0 && (t2[1] = t2[this.size], s2[t2[1]] = 1, i2[e2] = null, s2[e2] = this.kt, this.kt = e2, --this.size, this.size > 0 && this.yt(1)), n2;
  }
  delete(t2) {
    const i2 = this.At, s2 = this.It, e2 = this.gt;
    let n2;
    if (n2 = e2[t2], i2[n2] = i2[this.size], e2[i2[n2]] = n2, --this.size, this.size >= n2)
      if (n2 > 1) {
        const t3 = s2[i2[n2 >> 1]], e3 = s2[i2[n2]];
        e3.s > t3.s || t3.s === e3.s && e3.t >= t3.t ? this.yt(n2) : this.Tt(n2);
      } else
        this.yt(n2);
    s2[t2] = null, e2[t2] = this.kt, this.kt = t2;
  }
}

class tt {
  Dt;
  keys;
  order = null;
  size = 0;
  max = 0;
  Ot = 0;
  Lt;
  constructor(t2) {
    this.max = t2, this.size = 0, this.Ot = 0, this.Lt = 128 >= t2, this.Dt = new $(t2), this.Lt || (this.keys = Array(t2).fill(null));
  }
  reset(t2) {
    this.Dt.reset(t2), this.Lt = 128 >= t2, this.Lt || this.keys && this.max >= t2 || (this.keys = Array(t2).fill(null)), t2 > this.max && (this.max = t2), this.size = 0, this.Ot = 0, this.order = null;
  }
  P(t2) {
    if (this.Lt || this.Ot)
      return this.Dt.P(t2);
    const i2 = this.size;
    if (++this.size >= this.max) {
      const t3 = this.max;
      this.max *= 2;
      const i3 = Array(this.max).fill(null);
      for (let s2 = 0;t3 > s2; s2++)
        i3[s2] = this.keys[s2];
      this.keys = i3;
    }
    return this.keys[i2] = t2, -(i2 + 1);
  }
  init() {
    if (this.Lt)
      return this.Ot = 1, this.Dt.init(), 1;
    this.order = Array(this.size);
    for (let t3 = 0;this.size > t3; t3++)
      this.order[t3] = t3;
    const t2 = this.keys;
    return this.order.sort((i2, s2) => {
      const e2 = t2[i2], n2 = t2[s2];
      return n2.s > e2.s ? 1 : e2.s > n2.s || e2.t > n2.t ? -1 : 1;
    }), this.max = this.size, this.Ot = 1, this.Dt.init(), 1;
  }
  Mt() {
    if (this.Lt || this.size === 0)
      return this.Dt.Mt();
    const t2 = this.keys[this.order[this.size - 1]];
    if (!this.Dt.bt()) {
      const s2 = this.Dt.min();
      if (s2 && i(s2, t2))
        return this.Dt.Mt();
    }
    do {
      --this.size;
    } while (this.size > 0 && this.keys[this.order[this.size - 1]] === null);
    return t2;
  }
  min() {
    if (this.Lt || this.size === 0)
      return this.Dt.min();
    const t2 = this.keys[this.order[this.size - 1]];
    if (!this.Dt.bt()) {
      const s2 = this.Dt.min();
      if (s2 && i(s2, t2))
        return s2;
    }
    return t2;
  }
  delete(t2) {
    0 > t2 ? this.keys[-(t2 + 1)] = null : this.Dt.delete(t2);
  }
  bt() {
    return (this.Lt || this.size === 0) && this.Dt.bt();
  }
}

class it {
  head = new Z;
  frame;
  constructor(t2) {
    this.frame = t2, this.head.next = this.head, this.head.o = this.head;
  }
  min() {
    return this.head.next;
  }
  max() {
    return this.head.o;
  }
  P(t2) {
    return this.insertBefore(this.head, t2);
  }
  search(t2) {
    let i2 = this.head;
    do {
      i2 = i2.next;
    } while (i2.l !== null && !a(this.frame, t2, i2));
    return i2;
  }
  insertBefore(t2, i2) {
    do {
      t2 = t2.o;
    } while (t2.l !== null && !a(this.frame, t2, i2));
    return i2.next = t2.next, t2.next.o = i2, i2.o = t2, t2.next = i2, i2;
  }
  delete(t2) {
    t2.next.o = t2.o, t2.o.next = t2.next;
  }
}
var st = null;
var et = null;
var nt = [0, 0, 0, 0];
var ht = [null, null, null, null];
var rt = [0, 0, 0];

class lt {
  static Ct(t2, i2) {
    t2.u += i2.u, t2.h.u += i2.h.u;
  }
  static Gt(t2, s2) {
    let h2, r2, o2;
    if (h2 = s2.L, h2.O === h2 || h2.O.O === h2)
      throw Error("Monotone region has degenerate topology");
    for (;i(h2.h.i, h2.i); h2 = h2.C.h)
      ;
    for (;i(h2.i, h2.h.i); h2 = h2.O)
      ;
    for (r2 = h2.C.h;h2.O !== r2; )
      if (i(h2.h.i, r2.i)) {
        for (;r2.O !== h2 && (e(r2.O) || 0 >= l(r2.i, r2.h.i, r2.O.h.i)); )
          o2 = t2.connect(r2.O, r2), r2 = o2.h;
        r2 = r2.C.h;
      } else {
        for (;r2.O !== h2 && (n(h2.C.h) || l(h2.h.i, h2.i, h2.C.h.i) >= 0); )
          o2 = t2.connect(h2, h2.C.h), h2 = o2.h;
        h2 = h2.O;
      }
    if (r2.O === h2)
      throw Error("Monotone region has insufficient vertices");
    for (;r2.O.O !== h2; )
      o2 = t2.connect(r2.O, r2), r2 = o2.h;
    return 1;
  }
  static tessellateInterior(t2) {
    let i2;
    for (let s2 = t2.j.next;s2 !== t2.j; s2 = i2)
      i2 = s2.next, s2.p && lt.Gt(t2, s2);
    return 1;
  }
}
var ot = [];
var ut = new Int8Array(64);
var ct = new Int32Array(64);
var at = new Int32Array(64);
var ft;
((t2) => {
  t2[t2.Rt = 0] = "T_DORMANT", t2[t2.vt = 1] = "T_IN_POLYGON", t2[t2.xt = 2] = "T_IN_CONTOUR";
})(ft || (ft = {}));

class dt {
  state = ft.Rt;
  Ut = null;
  St = 0;
  Bt = 0;
  Vt = 1;
  Pt = 0;
  Ft = 0;
  Yt = 0;
  jt = 0;
  A;
  Ht = [0, 0, 0];
  zt;
  qt;
  Wt;
  Zt;
  M = Y.ODD;
  Kt = Y.ODD;
  _;
  S;
  event;
  Xt;
  Qt;
  Jt;
  $t;
  ti;
  ii;
  R;
  si;
  m = null;
  U = 0;
  gluTessCallback(t2, i2) {
    const s2 = i2 || null;
    switch (t2) {
      case 100100:
      case 100106:
        this.Xt = s2;
        break;
      case 100104:
      case 100110:
        this.$t = s2, this.flagBoundary = 1;
        break;
      case 100101:
      case 100107:
        this.Qt = s2;
        break;
      case 100102:
      case 100108:
        this.Jt = s2;
        break;
      case 100103:
        this.ti = s2;
        break;
      case 100109:
        this.ii = s2;
        break;
      case 100105:
      case 100111:
        this.R = s2;
        break;
      case 100112:
        this.si = s2;
        break;
      default:
        throw Error("GLU_INVALID_ENUM");
    }
  }
  gluTessProperty(t2, i2) {
    switch (t2) {
      case 100140: {
        const t3 = i2, s2 = 100130 > t3 ? t3 : t3 - 100130;
        if (0 > s2 || s2 > 4)
          throw Error("GLU_INVALID_VALUE");
        this.Kt = t3, this.M = s2;
        break;
      }
      case 100141:
        this.ei = !!i2;
        break;
      case 100142:
        break;
      default:
        throw Error("GLU_INVALID_ENUM");
    }
  }
  gluGetTessProperty(t2) {
    switch (t2) {
      case 100140:
        return this.Kt;
      case 100141:
        return this.ei;
      case 100142:
        return 0;
      default:
        throw Error("GLU_INVALID_ENUM");
    }
  }
  gluTessNormal(t2, i2, s2) {
    this.Ht[0] = t2, this.Ht[1] = i2, this.Ht[2] = s2, s2 === 0 || t2 || i2 || (this.Vt = s2 > 0 ? 1 : -1);
  }
  H(t2) {
    this.Xt && this.Xt(t2, this.m);
  }
  W(t2) {
    this.Qt && this.Qt(t2, this.m);
  }
  q() {
    this.Jt && this.Jt(this.m);
  }
  K(t2) {
    this.$t && this.$t(t2, this.m);
  }
  v(t2) {
    this.ii ? this.ii(t2, this.m) : this.ti && this.ti(t2);
  }
  ni(t2) {
    if (this.state !== t2)
      for (;this.state !== t2; )
        t2 > this.state ? this.state === ft.Rt ? (this.v(100151), this.gluTessBeginPolygon()) : this.state === ft.vt && (this.v(100152), this.gluTessBeginContour()) : this.state === ft.xt ? (this.v(100154), this.gluTessEndContour()) : this.state === ft.vt && (this.v(100153), this.gluTessEndPolygon());
  }
  ei = 0;
  flagBoundary = 0;
  hi() {
    const t2 = this.A, i2 = t2.Y, s2 = this.Ht[0], e2 = this.Ht[1], n2 = this.Ht[2];
    let h2, r2;
    if (this.zt || (this.zt = [0, 0, 0]), this.qt || (this.qt = [0, 0, 0]), this.Wt || (this.Wt = [0, 0]), this.Zt || (this.Zt = [0, 0]), h2 = this.zt, r2 = this.qt, this.Bt) {
      h2[0] = 1, h2[1] = 0, h2[2] = 0;
      const t3 = n2 > 0 ? 1 : -1;
      return r2[0] = 0, r2[1] = t3, r2[2] = 0, this.Wt[0] = this.Pt, this.Wt[1] = this.Yt, this.Zt[0] = this.Ft, void (this.Zt[1] = this.jt);
    }
    if (!this.St && !s2 && !e2) {
      let s3;
      h2[0] = 1, h2[1] = 0, h2[2] = 0;
      let e3 = 0;
      if (n2)
        s3 = n2 > 0 ? 1 : -1;
      else {
        const i3 = [0, 0, 0];
        v(t2, i3), s3 = i3[2] > 0 ? 1 : -1, e3 = 1;
      }
      r2[0] = 0, r2[1] = s3, r2[2] = 0;
      let l3 = i2.next, o3 = l3.coords[0], u3 = l3.coords[1] * s3;
      l3.s = o3, l3.t = u3;
      let c3 = o3, a3 = o3, f3 = u3, d3 = u3;
      for (l3 = l3.next;l3 !== i2; l3 = l3.next)
        o3 = l3.coords[0], u3 = l3.coords[1] * s3, l3.s = o3, l3.t = u3, c3 > o3 ? c3 = o3 : o3 > a3 && (a3 = o3), f3 > u3 ? f3 = u3 : u3 > d3 && (d3 = u3);
      return this.Wt[0] = c3, this.Zt[0] = a3, void (e3 ? (x(t2, this.qt), r2[1] !== s3 ? (this.Wt[1] = -d3, this.Zt[1] = -f3) : (this.Wt[1] = f3, this.Zt[1] = d3)) : (this.Wt[1] = f3, this.Zt[1] = d3));
    }
    let l2 = 0;
    const o2 = [s2, e2, n2];
    s2 || e2 || n2 || (v(t2, o2), l2 = 1);
    const u2 = ((t3) => {
      let i3 = 0;
      return Math.abs(t3[1]) > Math.abs(t3[0]) && (i3 = 1), Math.abs(t3[2]) > Math.abs(t3[i3]) && (i3 = 2), i3;
    })(o2);
    h2[u2] = 0, h2[(u2 + 1) % 3] = 1, h2[(u2 + 2) % 3] = 0, r2[u2] = 0, r2[(u2 + 1) % 3] = 0, r2[(u2 + 2) % 3] = o2[u2] > 0 ? 1 : -1;
    let c2 = i2.next;
    c2.s = c2.coords[0] * h2[0] + c2.coords[1] * h2[1] + c2.coords[2] * h2[2], c2.t = c2.coords[0] * r2[0] + c2.coords[1] * r2[1] + c2.coords[2] * r2[2];
    let { s: a2, s: f2, t: d2, t: w2 } = c2;
    for (c2 = c2.next;c2 !== i2; c2 = c2.next) {
      const t3 = c2.coords[0] * h2[0] + c2.coords[1] * h2[1] + c2.coords[2] * h2[2], i3 = c2.coords[0] * r2[0] + c2.coords[1] * r2[1] + c2.coords[2] * r2[2];
      c2.s = t3, c2.t = i3, a2 > t3 ? a2 = t3 : t3 > f2 && (f2 = t3), d2 > i3 ? d2 = i3 : i3 > w2 && (w2 = i3);
    }
    l2 && x(t2, this.qt), l2 && r2[(u2 + 2) % 3] !== (o2[u2] > 0 ? 1 : -1) ? (this.Wt[0] = a2, this.Zt[0] = f2, this.Wt[1] = -w2, this.Zt[1] = -d2) : (this.Wt[0] = a2, this.Zt[0] = f2, this.Wt[1] = d2, this.Zt[1] = w2);
  }
  gluTessBeginPolygon(t2) {
    this.ni(ft.Rt), this.state = ft.vt, this.U = 0, this.A = new J, this.St = 0, this.Bt = this.Ht[2] !== 0 && !this.Ht[0] && !this.Ht[1], this.Pt = Infinity, this.Ft = -Infinity, this.Yt = Infinity, this.jt = -Infinity, this.m = t2;
  }
  gluTessBeginContour() {
    this.ni(ft.vt), this.state = ft.xt, this.Ut = null;
  }
  gluTessVertex(t2, i2) {
    this.ni(ft.xt);
    let s2 = t2[0], e2 = t2[1], n2 = t2.length > 2 ? t2[2] : 0, h2 = 0;
    -1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000 > s2 ? (s2 = -1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000, h2 = 1) : s2 > 1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000 && (s2 = 1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000, h2 = 1), -1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000 > e2 ? (e2 = -1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000, h2 = 1) : e2 > 1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000 && (e2 = 1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000, h2 = 1), -1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000 > n2 ? (n2 = -1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000, h2 = 1) : n2 > 1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000 && (n2 = 1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000, h2 = 1), h2 && this.v(100155);
    let r2 = this.Ut;
    if (r2 === null ? (r2 = this.A.F(), this.A.splice(r2, r2.h)) : (this.A.V(r2), r2 = r2.O), r2.i.data = i2 || null, r2.i.coords[0] = s2, r2.i.coords[1] = e2, n2 !== 0 ? (r2.i.coords[2] = n2, this.St = 1, this.Bt = 0) : r2.i.coords[2] = 0, this.Bt) {
      r2.i.s = s2;
      const t3 = e2 * this.Vt;
      r2.i.t = t3, this.Pt > s2 && (this.Pt = s2), s2 > this.Ft && (this.Ft = s2), this.Yt > t3 && (this.Yt = t3), t3 > this.jt && (this.jt = t3);
    }
    r2.u = 1, r2.h.u = -1, this.Ut = r2;
  }
  gluTessEndContour() {
    this.ni(ft.xt), this.state = ft.vt;
  }
  gluTessEndPolygon() {
    this.ni(ft.vt), this.state = ft.Rt, this.compute(this.M, undefined, 0);
    const t2 = this.A;
    this.U || (this.ei ? (V(t2, 1), F(this, t2)) : this.flagBoundary ? (lt.tessellateInterior(t2), P(this, t2)) : U(this, t2)), this.si && this.si(t2), this.A = null, this.Ut = null, this.event = null, this.m = null, this._ = null;
  }
  gluDeleteTess() {
    this.ni(ft.Rt);
  }
  compute(i2 = Y.ODD, s2, e2 = 0) {
    this.state !== ft.Rt && this.state === ft.vt && (this.state = ft.Rt), this.A || (this.A = new J), s2 && (this.Ht[0] = s2[0], this.Ht[1] = s2[1], this.Ht[2] = s2[2]), this.M = i2, this.hi(), function(i3, s3 = 1) {
      let e3, n2;
      if (((i4) => {
        let s4, e4, n3, h2 = i4.A.Z;
        for (s4 = h2.next;s4 !== h2; s4 = e4)
          e4 = s4.next, n3 = s4.O, t(s4.i, s4.h.i) && s4.O.O !== s4 && (b(i4, n3, s4), i4.A.delete(s4), s4 = n3, n3 = s4.O), n3.O === s4 && (n3 !== s4 && (n3 !== e4 && n3 !== e4.h || (e4 = e4.next), i4.A.delete(n3)), s4 !== e4 && s4 !== e4.h || (e4 = e4.next), i4.A.delete(s4));
      })(i3), !((t2) => {
        let i4, s4, e4, n3 = t2.A.vertexCount + 8;
        for (t2.S ? (t2.S.reset(n3), i4 = t2.S) : i4 = t2.S = new tt(n3), e4 = t2.A.Y, s4 = e4.next;s4 !== e4; s4 = s4.next)
          s4.B = i4.P(s4);
        return s4 !== e4 ? 0 : (i4.init(), 1);
      })(i3))
        return 0;
      for (((t2) => {
        t2._ = new it(t2);
        let i4 = t2.Zt[0] - t2.Wt[0], s4 = t2.Zt[1] - t2.Wt[1], e4 = t2.Wt[0] - i4, n3 = t2.Zt[0] + i4, h2 = t2.Zt[1] + s4;
        m(t2, e4, n3, t2.Wt[1] - s4), m(t2, e4, n3, h2);
      })(i3);(e3 = i3.S.Mt()) !== null; ) {
        for (;n2 = i3.S.min(), n2 !== null && t(n2, e3); )
          n2 = i3.S.Mt(), b(i3, e3.L, n2.L);
        R(i3, e3);
      }
      i3.event = i3._.min().l.i, ((t2) => {
        let i4;
        for (;(i4 = t2._.min()).l !== null; )
          E(t2, i4);
      })(i3), ((t2, i4) => {
        let s4, e4, n3;
        for (s4 = i4.j.next;s4 !== i4.j; s4 = e4)
          e4 = s4.next, n3 = s4.L, n3.O.O === n3 && (w(n3.C, n3), t2.A.delete(n3));
      })(i3, i3.A), s3 && i3.A.check();
    }(this, e2);
  }
  renderBoundary() {
    this.A && (V(this.A, 1), F(this, this.A));
  }
  renderTriangles(t2 = 0) {
    this.A && (t2 ? (lt.tessellateInterior(this.A), P(this, this.A)) : U(this, this.A));
  }
}

class Tessellator {
  process(paths, removeOverlaps = true, isCFF = false, needsExtrusionContours = true) {
    if (paths.length === 0) {
      return { triangles: { vertices: [], indices: [] }, contours: [] };
    }
    const valid = paths.filter((path) => path.points.length >= 3);
    if (valid.length === 0) {
      return { triangles: { vertices: [], indices: [] }, contours: [] };
    }
    logger.log(`Tessellator: removeOverlaps=${removeOverlaps}, processing ${valid.length} paths`);
    return this.tessellate(valid, removeOverlaps, isCFF, needsExtrusionContours);
  }
  processContours(contours, removeOverlaps = true, isCFF = false, needsExtrusionContours = true) {
    if (contours.length === 0) {
      return { triangles: { vertices: [], indices: [] }, contours: [] };
    }
    return this.tessellateContours(contours, removeOverlaps, isCFF, needsExtrusionContours);
  }
  tessellate(paths, removeOverlaps, isCFF, needsExtrusionContours) {
    const needsWindingReversal = !isCFF && !removeOverlaps;
    let originalContours;
    let tessContours;
    if (needsWindingReversal) {
      tessContours = this.pathsToContours(paths, true);
      if (removeOverlaps || needsExtrusionContours) {
        originalContours = this.pathsToContours(paths);
      }
    } else {
      originalContours = this.pathsToContours(paths);
      tessContours = originalContours;
    }
    let extrusionContours = needsExtrusionContours ? needsWindingReversal ? tessContours : originalContours ?? this.pathsToContours(paths) : [];
    if (removeOverlaps) {
      logger.log("Two-pass: boundary extraction then triangulation");
      perfLogger.start("Tessellator.boundaryPass", {
        contourCount: tessContours.length
      });
      const boundaryResult = this.performTessellation(originalContours, "boundary");
      perfLogger.end("Tessellator.boundaryPass");
      if (!boundaryResult) {
        logger.warn("libtess returned empty result from boundary pass");
        return { triangles: { vertices: [], indices: [] }, contours: [] };
      }
      tessContours = this.boundaryToContours(boundaryResult);
      if (needsExtrusionContours) {
        extrusionContours = tessContours;
      }
      logger.log(`Boundary pass created ${tessContours.length} contours. Starting triangulation pass.`);
    } else {
      logger.log(`Single-pass triangulation for ${isCFF ? "CFF" : "TTF"}`);
    }
    perfLogger.start("Tessellator.triangulationPass", {
      contourCount: tessContours.length
    });
    const triangleResult = this.performTessellation(tessContours, "triangles");
    perfLogger.end("Tessellator.triangulationPass");
    if (!triangleResult) {
      const warning = removeOverlaps ? "libtess returned empty result from triangulation pass" : "libtess returned empty result from single-pass triangulation";
      logger.warn(warning);
      return {
        triangles: { vertices: [], indices: [] },
        contours: extrusionContours
      };
    }
    return {
      triangles: {
        vertices: triangleResult.vertices,
        indices: triangleResult.indices || []
      },
      contours: extrusionContours,
      contoursAreBoundary: removeOverlaps
    };
  }
  tessellateContours(contours, removeOverlaps, isCFF, needsExtrusionContours) {
    const needsWindingReversal = !isCFF && !removeOverlaps;
    let originalContours;
    let tessContours;
    if (needsWindingReversal) {
      tessContours = this.reverseContours(contours);
      if (removeOverlaps || needsExtrusionContours) {
        originalContours = contours;
      }
    } else {
      originalContours = contours;
      tessContours = contours;
    }
    let extrusionContours = needsExtrusionContours ? needsWindingReversal ? tessContours : originalContours ?? contours : [];
    if (removeOverlaps) {
      logger.log("Two-pass: boundary extraction then triangulation");
      perfLogger.start("Tessellator.boundaryPass", {
        contourCount: tessContours.length
      });
      const boundaryResult = this.performTessellation(originalContours, "boundary");
      perfLogger.end("Tessellator.boundaryPass");
      if (!boundaryResult) {
        logger.warn("libtess returned empty result from boundary pass");
        return { triangles: { vertices: [], indices: [] }, contours: [] };
      }
      tessContours = this.boundaryToContours(boundaryResult);
      if (needsExtrusionContours) {
        extrusionContours = tessContours;
      }
      logger.log(`Boundary pass created ${tessContours.length} contours. Starting triangulation pass.`);
    } else {
      logger.log(`Single-pass triangulation for ${isCFF ? "CFF" : "TTF"}`);
    }
    perfLogger.start("Tessellator.triangulationPass", {
      contourCount: tessContours.length
    });
    const triangleResult = this.performTessellation(tessContours, "triangles");
    perfLogger.end("Tessellator.triangulationPass");
    if (!triangleResult) {
      const warning = removeOverlaps ? "libtess returned empty result from triangulation pass" : "libtess returned empty result from single-pass triangulation";
      logger.warn(warning);
      return {
        triangles: { vertices: [], indices: [] },
        contours: extrusionContours
      };
    }
    return {
      triangles: {
        vertices: triangleResult.vertices,
        indices: triangleResult.indices || []
      },
      contours: extrusionContours,
      contoursAreBoundary: removeOverlaps
    };
  }
  pathsToContours(paths, reversePoints = false) {
    const contours = new Array(paths.length);
    for (let p2 = 0;p2 < paths.length; p2++) {
      const points = paths[p2].points;
      const pointCount = points.length;
      const isClosed = pointCount > 1 && points[0].x === points[pointCount - 1].x && points[0].y === points[pointCount - 1].y;
      const end = isClosed ? pointCount - 1 : pointCount;
      const contour = new Array((end + 1) * 2);
      let i2 = 0;
      if (reversePoints) {
        for (let k2 = end - 1;k2 >= 0; k2--) {
          const pt = points[k2];
          contour[i2++] = pt.x;
          contour[i2++] = pt.y;
        }
      } else {
        for (let k2 = 0;k2 < end; k2++) {
          const pt = points[k2];
          contour[i2++] = pt.x;
          contour[i2++] = pt.y;
        }
      }
      if (i2 >= 2) {
        contour[i2++] = contour[0];
        contour[i2++] = contour[1];
      }
      contours[p2] = contour;
    }
    return contours;
  }
  reverseContours(contours) {
    const reversed = new Array(contours.length);
    for (let i2 = 0;i2 < contours.length; i2++) {
      reversed[i2] = this.reverseContour(contours[i2]);
    }
    return reversed;
  }
  reverseContour(contour) {
    const len = contour.length;
    if (len === 0)
      return [];
    const isClosed = len >= 4 && contour[0] === contour[len - 2] && contour[1] === contour[len - 1];
    const end = isClosed ? len - 2 : len;
    if (end === 0)
      return [];
    const reversed = new Array(end + 2);
    let out = 0;
    for (let i2 = end - 2;i2 >= 0; i2 -= 2) {
      reversed[out++] = contour[i2];
      reversed[out++] = contour[i2 + 1];
    }
    if (out >= 2) {
      reversed[out++] = reversed[0];
      reversed[out++] = reversed[1];
    }
    return reversed;
  }
  performTessellation(contours, mode) {
    const tess = new dt;
    tess.gluTessProperty(H.WINDING_RULE, Y.NONZERO);
    const vertices = [];
    const indices = [];
    const contourIndices = [];
    let currentContour = [];
    if (mode === "boundary") {
      tess.gluTessProperty(H.BOUNDARY_ONLY, 1);
    }
    if (mode === "triangles") {
      tess.gluTessCallback(H.VERTEX_DATA, (data) => {
        indices.push(data);
      });
    } else {
      tess.gluTessCallback(H.BEGIN, () => {
        currentContour = [];
      });
      tess.gluTessCallback(H.VERTEX_DATA, (data) => {
        currentContour.push(data);
      });
      tess.gluTessCallback(H.END, () => {
        if (currentContour.length > 0) {
          contourIndices.push(currentContour);
        }
      });
    }
    tess.gluTessCallback(H.COMBINE, (coords) => {
      const idx = vertices.length / 2;
      vertices.push(coords[0], coords[1]);
      return idx;
    });
    tess.gluTessCallback(H.ERROR, (errno) => {
      logger.warn(`libtess error: ${errno}`);
    });
    tess.gluTessNormal(0, 0, 1);
    tess.gluTessBeginPolygon();
    for (const contour of contours) {
      tess.gluTessBeginContour();
      for (let i2 = 0;i2 < contour.length; i2 += 2) {
        const idx = vertices.length / 2;
        vertices.push(contour[i2], contour[i2 + 1]);
        tess.gluTessVertex([contour[i2], contour[i2 + 1]], idx);
      }
      tess.gluTessEndContour();
    }
    tess.gluTessEndPolygon();
    if (vertices.length === 0) {
      return null;
    }
    if (mode === "triangles") {
      return { vertices, indices };
    } else {
      return { vertices, contourIndices };
    }
  }
  boundaryToContours(boundaryResult) {
    if (!boundaryResult.contourIndices) {
      return [];
    }
    const contours = [];
    for (const indices of boundaryResult.contourIndices) {
      const contour = [];
      for (const idx of indices) {
        const vertIdx = idx * 2;
        contour.push(boundaryResult.vertices[vertIdx], boundaryResult.vertices[vertIdx + 1]);
      }
      if (contour.length > 2) {
        if (contour[0] !== contour[contour.length - 2] || contour[1] !== contour[contour.length - 1]) {
          contour.push(contour[0], contour[1]);
        }
      }
      contours.push(contour);
    }
    return contours;
  }
  needsWindingNormalization(contours) {
    if (contours.length === 0)
      return false;
    if (contours.length === 1)
      return false;
    let firstSign = null;
    for (const contour of contours) {
      const area = this.signedArea(contour);
      const sign = area >= 0 ? 1 : -1;
      if (firstSign === null) {
        firstSign = sign;
      } else if (sign !== firstSign) {
        return true;
      }
    }
    return false;
  }
  signedArea(contour) {
    let area = 0;
    const len = contour.length;
    if (len < 6)
      return 0;
    for (let i2 = 0;i2 < len; i2 += 2) {
      const x1 = contour[i2];
      const y1 = contour[i2 + 1];
      const x2 = contour[(i2 + 2) % len];
      const y2 = contour[(i2 + 3) % len];
      area += x1 * y2 - x2 * y1;
    }
    return area / 2;
  }
}

class Extruder {
  constructor() {}
  extrude(geometry, depth = 0, unitsPerEm) {
    const points = geometry.triangles.vertices;
    const triangleIndices = geometry.triangles.indices;
    const contours = geometry.contours;
    const contoursAreBoundary = geometry.contoursAreBoundary === true;
    const pointLen = points.length;
    const numPoints = pointLen / 2;
    let boundaryEdges = [];
    let sideEdgeCount = 0;
    let useContours = false;
    if (depth !== 0) {
      if (contoursAreBoundary && contours.length > 0) {
        useContours = true;
        for (const contour of contours) {
          const contourPointCount = contour.length >> 1;
          if (contourPointCount >= 2) {
            sideEdgeCount += contourPointCount - 1;
          }
        }
      } else {
        const PACK = 2097152;
        const edgeMap = new Map;
        const triLen2 = triangleIndices.length;
        for (let i2 = 0;i2 < triLen2; i2 += 3) {
          const a2 = triangleIndices[i2];
          const b2 = triangleIndices[i2 + 1];
          const c2 = triangleIndices[i2 + 2];
          let key, packed;
          if (a2 < b2) {
            key = a2 * PACK + b2;
          } else {
            key = b2 * PACK + a2;
          }
          packed = a2 * PACK + b2;
          let data = edgeMap.get(key);
          if (data === undefined) {
            edgeMap.set(key, packed);
          } else if (data !== null) {
            edgeMap.set(key, null);
          }
          if (b2 < c2) {
            key = b2 * PACK + c2;
          } else {
            key = c2 * PACK + b2;
          }
          packed = b2 * PACK + c2;
          data = edgeMap.get(key);
          if (data === undefined) {
            edgeMap.set(key, packed);
          } else if (data !== null) {
            edgeMap.set(key, null);
          }
          if (c2 < a2) {
            key = c2 * PACK + a2;
          } else {
            key = a2 * PACK + c2;
          }
          packed = c2 * PACK + a2;
          data = edgeMap.get(key);
          if (data === undefined) {
            edgeMap.set(key, packed);
          } else if (data !== null) {
            edgeMap.set(key, null);
          }
        }
        boundaryEdges = [];
        for (const packedEdge of edgeMap.values()) {
          if (packedEdge === null)
            continue;
          boundaryEdges.push(Math.floor(packedEdge / PACK), packedEdge % PACK);
        }
        sideEdgeCount = boundaryEdges.length >> 1;
      }
    }
    const sideVertexCount = sideEdgeCount * 4;
    const baseVertexCount = depth === 0 ? numPoints : numPoints * 2;
    const vertexCount = baseVertexCount + sideVertexCount;
    const vertices = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const indexCount = depth === 0 ? triangleIndices.length : triangleIndices.length * 2 + sideEdgeCount * 6;
    const indices = new Uint32Array(indexCount);
    if (depth === 0) {
      for (let p2 = 0, vPos = 0;p2 < pointLen; p2 += 2, vPos += 3) {
        vertices[vPos] = points[p2];
        vertices[vPos + 1] = points[p2 + 1];
        vertices[vPos + 2] = 0;
        normals[vPos] = 0;
        normals[vPos + 1] = 0;
        normals[vPos + 2] = 1;
      }
      indices.set(triangleIndices);
      return { vertices, normals, indices };
    }
    const minBackOffset = unitsPerEm * 0.000025;
    const backZ = depth <= minBackOffset ? minBackOffset : depth;
    const backOffset = numPoints * 3;
    for (let p2 = 0, vi = 0, base0 = 0;p2 < pointLen; p2 += 2, vi++, base0 += 3) {
      const x2 = points[p2];
      const y2 = points[p2 + 1];
      vertices[base0] = x2;
      vertices[base0 + 1] = y2;
      vertices[base0 + 2] = 0;
      normals[base0] = 0;
      normals[base0 + 1] = 0;
      normals[base0 + 2] = -1;
      const baseD = base0 + backOffset;
      vertices[baseD] = x2;
      vertices[baseD + 1] = y2;
      vertices[baseD + 2] = backZ;
      normals[baseD] = 0;
      normals[baseD + 1] = 0;
      normals[baseD + 2] = 1;
    }
    const triLen = triangleIndices.length;
    for (let i2 = 0;i2 < triLen; i2++) {
      indices[i2] = triangleIndices[triLen - 1 - i2];
    }
    for (let i2 = 0;i2 < triLen; i2++) {
      indices[triLen + i2] = triangleIndices[i2] + numPoints;
    }
    let nextVertex = numPoints * 2;
    let idxPos = triLen * 2;
    if (useContours) {
      for (const contour of contours) {
        const contourLen = contour.length;
        if (contourLen < 4)
          continue;
        for (let i2 = 0;i2 < contourLen - 2; i2 += 2) {
          const p0x = contour[i2];
          const p0y = contour[i2 + 1];
          const p1x = contour[i2 + 2];
          const p1y = contour[i2 + 3];
          const ex = p1x - p0x;
          const ey = p1y - p0y;
          const lenSq = ex * ex + ey * ey;
          let nx = 0;
          let ny = 0;
          if (lenSq > 0.0000000001) {
            const invLen = 1 / Math.sqrt(lenSq);
            nx = ey * invLen;
            ny = -ex * invLen;
          }
          const base = nextVertex * 3;
          vertices[base] = p0x;
          vertices[base + 1] = p0y;
          vertices[base + 2] = 0;
          vertices[base + 3] = p1x;
          vertices[base + 4] = p1y;
          vertices[base + 5] = 0;
          vertices[base + 6] = p0x;
          vertices[base + 7] = p0y;
          vertices[base + 8] = backZ;
          vertices[base + 9] = p1x;
          vertices[base + 10] = p1y;
          vertices[base + 11] = backZ;
          normals[base] = nx;
          normals[base + 1] = ny;
          normals[base + 2] = 0;
          normals[base + 3] = nx;
          normals[base + 4] = ny;
          normals[base + 5] = 0;
          normals[base + 6] = nx;
          normals[base + 7] = ny;
          normals[base + 8] = 0;
          normals[base + 9] = nx;
          normals[base + 10] = ny;
          normals[base + 11] = 0;
          const baseVertex = nextVertex;
          indices[idxPos] = baseVertex;
          indices[idxPos + 1] = baseVertex + 1;
          indices[idxPos + 2] = baseVertex + 2;
          indices[idxPos + 3] = baseVertex + 1;
          indices[idxPos + 4] = baseVertex + 3;
          indices[idxPos + 5] = baseVertex + 2;
          idxPos += 6;
          nextVertex += 4;
        }
      }
    } else {
      for (let e2 = 0;e2 < sideEdgeCount; e2++) {
        const edgeIndex = e2 << 1;
        const u2 = boundaryEdges[edgeIndex];
        const v2 = boundaryEdges[edgeIndex + 1];
        const u22 = u2 << 1;
        const v22 = v2 << 1;
        const p0x = points[u22];
        const p0y = points[u22 + 1];
        const p1x = points[v22];
        const p1y = points[v22 + 1];
        const ex = p1x - p0x;
        const ey = p1y - p0y;
        const lenSq = ex * ex + ey * ey;
        let nx = 0;
        let ny = 0;
        if (lenSq > 0.0000000001) {
          const invLen = 1 / Math.sqrt(lenSq);
          nx = ey * invLen;
          ny = -ex * invLen;
        }
        const base = nextVertex * 3;
        vertices[base] = p0x;
        vertices[base + 1] = p0y;
        vertices[base + 2] = 0;
        vertices[base + 3] = p1x;
        vertices[base + 4] = p1y;
        vertices[base + 5] = 0;
        vertices[base + 6] = p0x;
        vertices[base + 7] = p0y;
        vertices[base + 8] = backZ;
        vertices[base + 9] = p1x;
        vertices[base + 10] = p1y;
        vertices[base + 11] = backZ;
        normals[base] = nx;
        normals[base + 1] = ny;
        normals[base + 2] = 0;
        normals[base + 3] = nx;
        normals[base + 4] = ny;
        normals[base + 5] = 0;
        normals[base + 6] = nx;
        normals[base + 7] = ny;
        normals[base + 8] = 0;
        normals[base + 9] = nx;
        normals[base + 10] = ny;
        normals[base + 11] = 0;
        const baseVertex = nextVertex;
        indices[idxPos] = baseVertex;
        indices[idxPos + 1] = baseVertex + 1;
        indices[idxPos + 2] = baseVertex + 2;
        indices[idxPos + 3] = baseVertex + 1;
        indices[idxPos + 4] = baseVertex + 3;
        indices[idxPos + 5] = baseVertex + 2;
        idxPos += 6;
        nextVertex += 4;
      }
    }
    return { vertices, normals, indices };
  }
}
var OVERLAP_EPSILON = 0.001;

class BoundaryClusterer {
  constructor() {}
  cluster(glyphContoursList, positions) {
    perfLogger.start("BoundaryClusterer.cluster", {
      glyphCount: glyphContoursList.length
    });
    const n2 = glyphContoursList.length;
    if (n2 === 0) {
      perfLogger.end("BoundaryClusterer.cluster");
      return [];
    }
    if (n2 === 1) {
      perfLogger.end("BoundaryClusterer.cluster");
      return [[0]];
    }
    const result = this.clusterSweepLine(glyphContoursList, positions);
    perfLogger.end("BoundaryClusterer.cluster");
    return result;
  }
  clusterSweepLine(glyphContoursList, positions) {
    const n2 = glyphContoursList.length;
    const bounds = new Array(n2);
    const events = new Array(2 * n2);
    let eventIndex = 0;
    for (let i2 = 0;i2 < n2; i2++) {
      bounds[i2] = this.getWorldBounds(glyphContoursList[i2], positions[i2]);
      events[eventIndex++] = [bounds[i2].minX, 0, i2];
      events[eventIndex++] = [bounds[i2].maxX, 1, i2];
    }
    events.sort((a2, b2) => a2[0] - b2[0] || a2[1] - b2[1]);
    const parent = Array.from({ length: n2 }, (_2, i2) => i2);
    const rank = new Array(n2).fill(0);
    function find(x2) {
      return parent[x2] === x2 ? x2 : parent[x2] = find(parent[x2]);
    }
    function union(x2, y2) {
      const px = find(x2);
      const py = find(y2);
      if (px === py)
        return;
      if (rank[px] < rank[py]) {
        parent[px] = py;
      } else if (rank[px] > rank[py]) {
        parent[py] = px;
      } else {
        parent[py] = px;
        rank[px]++;
      }
    }
    const active = new Set;
    for (const [, eventType, glyphIndex] of events) {
      if (eventType === 0) {
        const bounds1 = bounds[glyphIndex];
        for (const activeIndex of active) {
          const bounds2 = bounds[activeIndex];
          if (bounds1.minY < bounds2.maxY + OVERLAP_EPSILON && bounds1.maxY > bounds2.minY - OVERLAP_EPSILON) {
            union(glyphIndex, activeIndex);
          }
        }
        active.add(glyphIndex);
      } else {
        active.delete(glyphIndex);
      }
    }
    const clusters = new Map;
    for (let i2 = 0;i2 < n2; i2++) {
      const root = find(i2);
      let list = clusters.get(root);
      if (!list) {
        list = [];
        clusters.set(root, list);
      }
      list.push(i2);
    }
    return Array.from(clusters.values());
  }
  getWorldBounds(contours, position) {
    return {
      minX: contours.bounds.min.x + position.x,
      minY: contours.bounds.min.y + position.y,
      maxX: contours.bounds.max.x + position.x,
      maxY: contours.bounds.max.y + position.y
    };
  }
}
var DEFAULT_OPTIMIZATION_CONFIG = {
  enabled: true,
  areaThreshold: 1
};
var _cap = 1024;
var _px = new Float64Array(_cap);
var _py = new Float64Array(_cap);
var _area = new Float64Array(_cap);
var _prev = new Int32Array(_cap);
var _next = new Int32Array(_cap);
var _heap = new Int32Array(_cap);
var _hpos = new Int32Array(_cap);
function ensureCap(n2) {
  if (n2 <= _cap)
    return;
  _cap = 1;
  while (_cap < n2)
    _cap <<= 1;
  _px = new Float64Array(_cap);
  _py = new Float64Array(_cap);
  _area = new Float64Array(_cap);
  _prev = new Int32Array(_cap);
  _next = new Int32Array(_cap);
  _heap = new Int32Array(_cap);
  _hpos = new Int32Array(_cap);
}

class PathOptimizer {
  constructor(config) {
    this.stats = {
      pointsRemovedByVisvalingam: 0,
      originalPointCount: 0
    };
    this.config = config;
  }
  setConfig(config) {
    this.config = config;
  }
  optimizePath(path) {
    const points = path.points;
    const n2 = points.length;
    if (n2 < 5 || !this.config.enabled) {
      if (this.config.enabled)
        this.stats.originalPointCount += n2;
      return path;
    }
    this.stats.originalPointCount += n2;
    const removed = simplifyVW(points, n2, this.config.areaThreshold);
    if (removed === 0)
      return path;
    this.stats.pointsRemovedByVisvalingam += removed;
    const result = new Array(n2 - removed);
    let idx = 0;
    let out = 0;
    while (idx >= 0) {
      result[out++] = points[idx];
      idx = _next[idx];
    }
    return { ...path, points: result };
  }
  getStats() {
    return { ...this.stats };
  }
  resetStats() {
    this.stats = {
      pointsRemovedByVisvalingam: 0,
      originalPointCount: 0
    };
  }
}
function simplifyVW(points, n2, areaThreshold) {
  if (n2 <= 3)
    return 0;
  ensureCap(n2);
  const px = _px;
  const py = _py;
  const area = _area;
  const prev = _prev;
  const next = _next;
  const heap = _heap;
  const hpos = _hpos;
  for (let i2 = 0;i2 < n2; i2++) {
    const p2 = points[i2];
    px[i2] = p2.x;
    py[i2] = p2.y;
    prev[i2] = i2 - 1;
    next[i2] = i2 + 1;
  }
  next[n2 - 1] = -1;
  const heapLen0 = n2 - 2;
  area[0] = Infinity;
  area[n2 - 1] = Infinity;
  for (let i2 = 1;i2 < n2 - 1; i2++) {
    area[i2] = area2x(px, py, i2 - 1, i2, i2 + 1);
    heap[i2 - 1] = i2;
    hpos[i2] = i2 - 1;
  }
  hpos[0] = -1;
  hpos[n2 - 1] = -1;
  let heapLen = heapLen0;
  for (let i2 = (heapLen >> 1) - 1;i2 >= 0; i2--) {
    siftDown(heap, hpos, area, i2, heapLen);
  }
  const threshold2x = areaThreshold * 2;
  const maxRemovals = n2 - 3;
  let removed = 0;
  while (heapLen > 0 && removed < maxRemovals) {
    const minIdx = heap[0];
    if (area[minIdx] > threshold2x)
      break;
    heapLen--;
    if (heapLen > 0) {
      const last = heap[heapLen];
      heap[0] = last;
      hpos[last] = 0;
      siftDown(heap, hpos, area, 0, heapLen);
    }
    hpos[minIdx] = -1;
    const pi = prev[minIdx];
    const ni = next[minIdx];
    if (pi >= 0)
      next[pi] = ni;
    if (ni >= 0)
      prev[ni] = pi;
    removed++;
    if (pi >= 0 && prev[pi] >= 0) {
      const oldArea = area[pi];
      const newArea = area2x(px, py, prev[pi], pi, ni);
      area[pi] = newArea;
      const pos = hpos[pi];
      if (pos >= 0) {
        if (newArea < oldArea)
          siftUp(heap, hpos, area, pos);
        else if (newArea > oldArea)
          siftDown(heap, hpos, area, pos, heapLen);
      }
    }
    if (ni >= 0 && next[ni] >= 0) {
      const oldArea = area[ni];
      const newArea = area2x(px, py, pi, ni, next[ni]);
      area[ni] = newArea;
      const pos = hpos[ni];
      if (pos >= 0) {
        if (newArea < oldArea)
          siftUp(heap, hpos, area, pos);
        else if (newArea > oldArea)
          siftDown(heap, hpos, area, pos, heapLen);
      }
    }
  }
  return removed;
}
function siftUp(heap, hpos, area, i2) {
  const idx = heap[i2];
  const val = area[idx];
  while (i2 > 0) {
    const parent = i2 - 1 >> 1;
    const pidx = heap[parent];
    if (area[pidx] <= val)
      break;
    heap[i2] = pidx;
    hpos[pidx] = i2;
    i2 = parent;
  }
  heap[i2] = idx;
  hpos[idx] = i2;
}
function siftDown(heap, hpos, area, i2, len) {
  const idx = heap[i2];
  const val = area[idx];
  const half = len >> 1;
  while (i2 < half) {
    let child = (i2 << 1) + 1;
    let childIdx = heap[child];
    let childVal = area[childIdx];
    const right = child + 1;
    if (right < len) {
      const rIdx = heap[right];
      const rVal = area[rIdx];
      if (rVal < childVal) {
        child = right;
        childIdx = rIdx;
        childVal = rVal;
      }
    }
    if (childVal >= val)
      break;
    heap[i2] = childIdx;
    hpos[childIdx] = i2;
    i2 = child;
  }
  heap[i2] = idx;
  hpos[idx] = i2;
}
function area2x(px, py, i1, i2, i3) {
  const v2 = px[i1] * (py[i2] - py[i3]) + px[i2] * (py[i3] - py[i1]) + px[i3] * (py[i1] - py[i2]);
  return v2 < 0 ? -v2 : v2;
}
var DEFAULT_CURVE_FIDELITY = {
  distanceTolerance: 0.5,
  angleTolerance: 0.2,
  cuspLimit: 0,
  collinearityEpsilon: 0.000001,
  recursionLimit: 16
};
var COLLINEARITY_EPSILON = DEFAULT_CURVE_FIDELITY.collinearityEpsilon;
var _out;
var _distTolSq = 0;
var _colEps = 0;
var _maxLvl = 0;
var _angleTol = 0;
var _tanAngSq = 0;
var _cuspLim = 0;
var _tanCuspSq = 0;
function emit(x2, y2) {
  _out.push(new Vec2(x2, y2));
}
function quadRec(x1, y1, x2, y2, x3, y3, level) {
  if (level > _maxLvl)
    return;
  const x12 = (x1 + x2) * 0.5;
  const y12 = (y1 + y2) * 0.5;
  const x23 = (x2 + x3) * 0.5;
  const y23 = (y2 + y3) * 0.5;
  const x123 = (x12 + x23) * 0.5;
  const y123 = (y12 + y23) * 0.5;
  const dx = x3 - x1;
  const dy = y3 - y1;
  let d2 = Math.abs((x2 - x3) * dy - (y2 - y3) * dx);
  if (d2 > _colEps) {
    if (d2 * d2 <= _distTolSq * (dx * dx + dy * dy)) {
      if (_angleTol > 0) {
        const v1x = x2 - x1;
        const v1y = y2 - y1;
        const v2x = x3 - x2;
        const v2y = y3 - y2;
        const cross = v1x * v2y - v1y * v2x;
        const dot = v1x * v2x + v1y * v2y;
        if (dot > 0 && cross * cross < _tanAngSq * dot * dot) {
          emit(x123, y123);
          return;
        }
      } else {
        emit(x123, y123);
        return;
      }
    }
  } else {
    let da = dx * dx + dy * dy;
    if (da === 0) {
      d2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    } else {
      d2 = ((x2 - x1) * dx + (y2 - y1) * dy) / da;
      if (d2 > 0 && d2 < 1)
        return;
      if (d2 <= 0)
        d2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
      else if (d2 >= 1)
        d2 = (x2 - x3) * (x2 - x3) + (y2 - y3) * (y2 - y3);
      else {
        const px = x1 + d2 * dx;
        const py = y1 + d2 * dy;
        d2 = (x2 - px) * (x2 - px) + (y2 - py) * (y2 - py);
      }
    }
    if (d2 < _distTolSq) {
      emit(x2, y2);
      return;
    }
  }
  const nl = level + 1;
  quadRec(x1, y1, x12, y12, x123, y123, nl);
  quadRec(x123, y123, x23, y23, x3, y3, nl);
}
function cubicBegin(x1, y1, x2, y2, x3, y3, x4, y4) {
  const x12 = (x1 + x2) * 0.5;
  const y12 = (y1 + y2) * 0.5;
  const x23 = (x2 + x3) * 0.5;
  const y23 = (y2 + y3) * 0.5;
  const x34 = (x3 + x4) * 0.5;
  const y34 = (y3 + y4) * 0.5;
  const x123 = (x12 + x23) * 0.5;
  const y123 = (y12 + y23) * 0.5;
  const x234 = (x23 + x34) * 0.5;
  const y234 = (y23 + y34) * 0.5;
  const x1234 = (x123 + x234) * 0.5;
  const y1234 = (y123 + y234) * 0.5;
  cubicRec(x1, y1, x12, y12, x123, y123, x1234, y1234, 1);
  cubicRec(x1234, y1234, x234, y234, x34, y34, x4, y4, 1);
}
function cubicRec(x1, y1, x2, y2, x3, y3, x4, y4, level) {
  if (level > _maxLvl)
    return;
  const x12 = (x1 + x2) * 0.5;
  const y12 = (y1 + y2) * 0.5;
  const x23 = (x2 + x3) * 0.5;
  const y23 = (y2 + y3) * 0.5;
  const x34 = (x3 + x4) * 0.5;
  const y34 = (y3 + y4) * 0.5;
  const x123 = (x12 + x23) * 0.5;
  const y123 = (y12 + y23) * 0.5;
  const x234 = (x23 + x34) * 0.5;
  const y234 = (y23 + y34) * 0.5;
  const x1234 = (x123 + x234) * 0.5;
  const y1234 = (y123 + y234) * 0.5;
  const dx = x4 - x1;
  const dy = y4 - y1;
  let d2 = Math.abs((x2 - x4) * dy - (y2 - y4) * dx);
  let d3 = Math.abs((x3 - x4) * dy - (y3 - y4) * dx);
  const sc = (d2 > _colEps ? 2 : 0) + (d3 > _colEps ? 1 : 0);
  switch (sc) {
    case 0: {
      let k2 = dx * dx + dy * dy;
      if (k2 === 0) {
        d2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
        d3 = (x3 - x1) * (x3 - x1) + (y3 - y1) * (y3 - y1);
      } else {
        k2 = 1 / k2;
        let t1 = x2 - x1;
        let t2 = y2 - y1;
        d2 = k2 * (t1 * dx + t2 * dy);
        t1 = x3 - x1;
        t2 = y3 - y1;
        d3 = k2 * (t1 * dx + t2 * dy);
        if (d2 > 0 && d2 < 1 && d3 > 0 && d3 < 1)
          return;
        if (d2 <= 0)
          d2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
        else if (d2 >= 1)
          d2 = (x2 - x4) * (x2 - x4) + (y2 - y4) * (y2 - y4);
        else {
          const px = x1 + d2 * dx, py = y1 + d2 * dy;
          d2 = (x2 - px) * (x2 - px) + (y2 - py) * (y2 - py);
        }
        if (d3 <= 0)
          d3 = (x3 - x1) * (x3 - x1) + (y3 - y1) * (y3 - y1);
        else if (d3 >= 1)
          d3 = (x3 - x4) * (x3 - x4) + (y3 - y4) * (y3 - y4);
        else {
          const px = x1 + d3 * dx, py = y1 + d3 * dy;
          d3 = (x3 - px) * (x3 - px) + (y3 - py) * (y3 - py);
        }
      }
      if (d2 > d3) {
        if (d2 < _distTolSq) {
          emit(x2, y2);
          return;
        }
      } else {
        if (d3 < _distTolSq) {
          emit(x3, y3);
          return;
        }
      }
      break;
    }
    case 1:
      if (d3 * d3 <= _distTolSq * (dx * dx + dy * dy)) {
        if (_angleTol > 0) {
          const v1x = x3 - x2, v1y = y3 - y2;
          const v2x = x4 - x3, v2y = y4 - y3;
          const cross = v1x * v2y - v1y * v2x;
          const dot = v1x * v2x + v1y * v2y;
          if (dot > 0 && cross * cross < _tanAngSq * dot * dot) {
            emit(x2, y2);
            emit(x3, y3);
            return;
          }
          if (_cuspLim > 0 && (dot <= 0 || cross * cross > _tanCuspSq * dot * dot)) {
            emit(x3, y3);
            return;
          }
        } else {
          emit(x23, y23);
          return;
        }
      }
      break;
    case 2:
      if (d2 * d2 <= _distTolSq * (dx * dx + dy * dy)) {
        if (_angleTol > 0) {
          const v1x = x2 - x1, v1y = y2 - y1;
          const v2x = x3 - x2, v2y = y3 - y2;
          const cross = v1x * v2y - v1y * v2x;
          const dot = v1x * v2x + v1y * v2y;
          if (dot > 0 && cross * cross < _tanAngSq * dot * dot) {
            emit(x2, y2);
            emit(x3, y3);
            return;
          }
          if (_cuspLim > 0 && (dot <= 0 || cross * cross > _tanCuspSq * dot * dot)) {
            emit(x2, y2);
            return;
          }
        } else {
          emit(x23, y23);
          return;
        }
      }
      break;
    case 3: {
      if ((d2 + d3) * (d2 + d3) <= _distTolSq * (dx * dx + dy * dy)) {
        if (_angleTol > 0) {
          const a1x = x2 - x1, a1y = y2 - y1;
          const a2x = x3 - x2, a2y = y3 - y2;
          const c1 = a1x * a2y - a1y * a2x;
          const dot1 = a1x * a2x + a1y * a2y;
          const b2x = x4 - x3, b2y = y4 - y3;
          const c2 = a2x * b2y - a2y * b2x;
          const dot2 = a2x * b2x + a2y * b2y;
          if (dot1 > 0 && dot2 > 0) {
            const ac1 = c1 < 0 ? -c1 : c1;
            const ac2 = c2 < 0 ? -c2 : c2;
            const cc = ac1 * dot2 + ac2 * dot1;
            const cd = dot1 * dot2 - ac1 * ac2;
            if (cd > 0 && cc * cc < _tanAngSq * cd * cd) {
              emit(x23, y23);
              return;
            }
          }
          if (_cuspLim > 0) {
            if (dot1 <= 0 || c1 * c1 > _tanCuspSq * dot1 * dot1) {
              emit(x2, y2);
              return;
            }
            if (dot2 <= 0 || c2 * c2 > _tanCuspSq * dot2 * dot2) {
              emit(x3, y3);
              return;
            }
          }
        } else {
          emit(x23, y23);
          return;
        }
      }
      break;
    }
  }
  const nl = level + 1;
  cubicRec(x1, y1, x12, y12, x123, y123, x1234, y1234, nl);
  cubicRec(x1234, y1234, x234, y234, x34, y34, x4, y4, nl);
}

class Polygonizer {
  constructor(curveFidelityConfig) {
    this.curveSteps = null;
    this._distTolSq = 0;
    this._angleTol = 0;
    this._tanAngSq = 0;
    this._cuspLim = 0;
    this._tanCuspSq = 0;
    this._colEps = 0;
    this._maxLvl = 0;
    this.curveFidelityConfig = {
      ...DEFAULT_CURVE_FIDELITY,
      ...curveFidelityConfig
    };
    this.precompute();
  }
  setCurveFidelityConfig(curveFidelityConfig) {
    this.curveFidelityConfig = {
      ...DEFAULT_CURVE_FIDELITY,
      ...curveFidelityConfig
    };
    this.precompute();
  }
  precompute() {
    const c2 = this.curveFidelityConfig;
    const dt2 = c2.distanceTolerance ?? DEFAULT_CURVE_FIDELITY.distanceTolerance;
    this._distTolSq = dt2 * dt2;
    this._angleTol = c2.angleTolerance ?? DEFAULT_CURVE_FIDELITY.angleTolerance;
    this._tanAngSq = this._angleTol > 0 ? Math.tan(this._angleTol) ** 2 : 0;
    this._cuspLim = c2.cuspLimit ?? 0;
    this._tanCuspSq = this._cuspLim > 0 ? Math.tan(this._cuspLim) ** 2 : 0;
    this._colEps = c2.collinearityEpsilon ?? DEFAULT_CURVE_FIDELITY.collinearityEpsilon;
    this._maxLvl = c2.recursionLimit ?? DEFAULT_CURVE_FIDELITY.recursionLimit;
  }
  activate() {
    _distTolSq = this._distTolSq;
    _angleTol = this._angleTol;
    _tanAngSq = this._tanAngSq;
    _cuspLim = this._cuspLim;
    _tanCuspSq = this._tanCuspSq;
    _colEps = this._colEps;
    _maxLvl = this._maxLvl;
    _out = [];
  }
  setCurveSteps(curveSteps) {
    if (curveSteps === undefined || curveSteps === null) {
      this.curveSteps = null;
      return;
    }
    if (!Number.isFinite(curveSteps)) {
      this.curveSteps = null;
      return;
    }
    const stepsInt = Math.round(curveSteps);
    this.curveSteps = stepsInt >= 1 ? stepsInt : null;
  }
  polygonizeQuadratic(start, control, end) {
    if (this.curveSteps !== null) {
      return this.polygonizeQuadraticFixedSteps(start, control, end, this.curveSteps);
    }
    this.activate();
    quadRec(start.x, start.y, control.x, control.y, end.x, end.y, 0);
    emit(end.x, end.y);
    return _out;
  }
  polygonizeCubic(start, control1, control2, end) {
    if (this.curveSteps !== null) {
      return this.polygonizeCubicFixedSteps(start, control1, control2, end, this.curveSteps);
    }
    this.activate();
    cubicBegin(start.x, start.y, control1.x, control1.y, control2.x, control2.y, end.x, end.y);
    emit(end.x, end.y);
    return _out;
  }
  polygonizeQuadraticFixedSteps(start, control, end, steps) {
    this.activate();
    for (let i2 = 1;i2 <= steps; i2++) {
      const t2 = i2 / steps;
      const x12 = start.x + (control.x - start.x) * t2;
      const y12 = start.y + (control.y - start.y) * t2;
      const x23 = control.x + (end.x - control.x) * t2;
      const y23 = control.y + (end.y - control.y) * t2;
      emit(x12 + (x23 - x12) * t2, y12 + (y23 - y12) * t2);
    }
    return _out;
  }
  polygonizeCubicFixedSteps(start, control1, control2, end, steps) {
    this.activate();
    for (let i2 = 1;i2 <= steps; i2++) {
      const t2 = i2 / steps;
      const x12 = start.x + (control1.x - start.x) * t2;
      const y12 = start.y + (control1.y - start.y) * t2;
      const x23 = control1.x + (control2.x - control1.x) * t2;
      const y23 = control1.y + (control2.y - control1.y) * t2;
      const x34 = control2.x + (end.x - control2.x) * t2;
      const y34 = control2.y + (end.y - control2.y) * t2;
      const x123 = x12 + (x23 - x12) * t2;
      const y123 = y12 + (y23 - y12) * t2;
      const x234 = x23 + (x34 - x23) * t2;
      const y234 = y23 + (y34 - y23) * t2;
      emit(x123 + (x234 - x123) * t2, y123 + (y234 - y123) * t2);
    }
    return _out;
  }
}

class GlyphContourCollector {
  constructor(curveFidelityConfig, optimizationConfig) {
    this.currentGlyphId = 0;
    this.currentTextIndex = 0;
    this.currentGlyphPaths = [];
    this.currentPath = null;
    this.currentPoint = null;
    this.currentGlyphBounds = {
      min: new Vec2(Infinity, Infinity),
      max: new Vec2(-Infinity, -Infinity)
    };
    this.collectedGlyphs = [];
    this.glyphPositions = [];
    this.glyphTextIndices = [];
    this.currentPosition = new Vec2(0, 0);
    this.polygonizer = new Polygonizer(curveFidelityConfig);
    this.pathOptimizer = new PathOptimizer({
      ...DEFAULT_OPTIMIZATION_CONFIG,
      ...optimizationConfig
    });
  }
  setPosition(x2, y2) {
    this.currentPosition.set(x2, y2);
  }
  updatePosition(dx, dy) {
    this.currentPosition.x += dx;
    this.currentPosition.y += dy;
  }
  beginGlyph(glyphId, textIndex) {
    if (this.currentGlyphPaths.length > 0) {
      this.finishGlyph();
    }
    this.currentGlyphId = glyphId;
    this.currentTextIndex = textIndex;
    this.currentGlyphPaths = [];
    this.currentGlyphBounds.min.set(Infinity, Infinity);
    this.currentGlyphBounds.max.set(-Infinity, -Infinity);
    this.glyphPositions.push(this.currentPosition.clone());
    perfLogger.start("Glyph.polygonizeAndOptimize", {
      glyphId,
      textIndex
    });
  }
  finishGlyph() {
    if (this.currentPath) {
      this.finishPath();
    }
    if (this.currentGlyphPaths.length > 0) {
      this.collectedGlyphs.push({
        glyphId: this.currentGlyphId,
        paths: this.currentGlyphPaths,
        bounds: {
          min: {
            x: this.currentGlyphBounds.min.x,
            y: this.currentGlyphBounds.min.y
          },
          max: {
            x: this.currentGlyphBounds.max.x,
            y: this.currentGlyphBounds.max.y
          }
        }
      });
      this.glyphTextIndices.push(this.currentTextIndex);
    }
    perfLogger.end("Glyph.polygonizeAndOptimize");
    this.currentGlyphPaths = [];
  }
  onMoveTo(x2, y2) {
    if (this.currentPath) {
      this.finishPath();
    }
    this.currentPoint = new Vec2(x2, y2);
    this.updateBounds(this.currentPoint);
    this.currentPath = {
      points: [this.currentPoint],
      glyphIndex: this.currentGlyphId
    };
  }
  onLineTo(x2, y2) {
    if (!this.currentPath || !this.currentPoint)
      return;
    const point = new Vec2(x2, y2);
    this.updateBounds(point);
    this.currentPath.points.push(point);
    this.currentPoint = point;
  }
  onQuadTo(cx, cy, x2, y2) {
    if (!this.currentPath || !this.currentPoint)
      return;
    const start = this.currentPoint;
    const control = new Vec2(cx, cy);
    const end = new Vec2(x2, y2);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const d2 = Math.abs((control.x - end.x) * dy - (control.y - end.y) * dx);
    if (d2 < COLLINEARITY_EPSILON) {
      this.onLineTo(x2, y2);
      return;
    }
    const flattenedPoints = this.polygonizer.polygonizeQuadratic(start, control, end);
    for (let i2 = 0;i2 < flattenedPoints.length; i2++) {
      const pt = flattenedPoints[i2];
      this.updateBounds(pt);
      this.currentPath.points.push(pt);
    }
    this.currentPoint = end;
  }
  onCubicTo(c1x, c1y, c2x, c2y, x2, y2) {
    if (!this.currentPath || !this.currentPoint)
      return;
    const start = this.currentPoint;
    const control1 = new Vec2(c1x, c1y);
    const control2 = new Vec2(c2x, c2y);
    const end = new Vec2(x2, y2);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const d1 = Math.abs((control1.x - end.x) * dy - (control1.y - end.y) * dx);
    const d2 = Math.abs((control2.x - end.x) * dy - (control2.y - end.y) * dx);
    if (d1 < COLLINEARITY_EPSILON && d2 < COLLINEARITY_EPSILON) {
      this.onLineTo(x2, y2);
      return;
    }
    const flattenedPoints = this.polygonizer.polygonizeCubic(start, control1, control2, end);
    for (let i2 = 0;i2 < flattenedPoints.length; i2++) {
      const pt = flattenedPoints[i2];
      this.updateBounds(pt);
      this.currentPath.points.push(pt);
    }
    this.currentPoint = end;
  }
  onClosePath() {
    if (!this.currentPath || !this.currentPoint)
      return;
    const firstPoint = this.currentPath.points[0];
    if (!this.currentPoint.equals(firstPoint)) {
      this.currentPath.points.push(firstPoint);
    }
    this.finishPath();
  }
  finishPath() {
    if (this.currentPath) {
      const path = this.pathOptimizer.optimizePath(this.currentPath);
      this.currentGlyphPaths.push(path);
      this.currentPath = null;
      this.currentPoint = null;
    }
  }
  updateBounds(point) {
    this.currentGlyphBounds.min.x = Math.min(this.currentGlyphBounds.min.x, point.x);
    this.currentGlyphBounds.min.y = Math.min(this.currentGlyphBounds.min.y, point.y);
    this.currentGlyphBounds.max.x = Math.max(this.currentGlyphBounds.max.x, point.x);
    this.currentGlyphBounds.max.y = Math.max(this.currentGlyphBounds.max.y, point.y);
  }
  getCollectedGlyphs() {
    if (this.currentGlyphPaths.length > 0) {
      this.finishGlyph();
    }
    return this.collectedGlyphs;
  }
  getGlyphPositions() {
    return this.glyphPositions;
  }
  getTextIndices() {
    return this.glyphTextIndices;
  }
  reset() {
    this.collectedGlyphs = [];
    this.glyphPositions = [];
    this.glyphTextIndices = [];
    this.currentGlyphPaths = [];
    this.currentPath = null;
    this.currentPoint = null;
    this.currentGlyphId = 0;
    this.currentTextIndex = 0;
    this.currentPosition.set(0, 0);
    this.currentGlyphBounds = {
      min: new Vec2(Infinity, Infinity),
      max: new Vec2(-Infinity, -Infinity)
    };
  }
  setCurveFidelityConfig(config) {
    this.polygonizer.setCurveFidelityConfig(config);
  }
  setCurveSteps(curveSteps) {
    this.polygonizer.setCurveSteps(curveSteps);
  }
  setGeometryOptimization(options) {
    this.pathOptimizer.setConfig({
      ...DEFAULT_OPTIMIZATION_CONFIG,
      ...options
    });
  }
  getOptimizationStats() {
    return this.pathOptimizer.getStats();
  }
}

class DrawCallbackHandler {
  constructor() {
    this.moveTo_func = null;
    this.lineTo_func = null;
    this.quadTo_func = null;
    this.cubicTo_func = null;
    this.closePath_func = null;
    this.drawFuncsPtr = 0;
    this.position = { x: 0, y: 0 };
  }
  setPosition(x2, y2) {
    this.position.x = x2;
    this.position.y = y2;
    if (this.collector) {
      this.collector.setPosition(x2, y2);
    }
  }
  updatePosition(dx, dy) {
    this.position.x += dx;
    this.position.y += dy;
    if (this.collector) {
      this.collector.updatePosition(dx, dy);
    }
  }
  setCollector(collector) {
    this.collector = collector;
  }
  createDrawFuncs(font, collector) {
    if (!font || !font.module || !font.hb) {
      throw new Error("Invalid font object");
    }
    this.collector = collector;
    if (this.drawFuncsPtr) {
      return;
    }
    const module = font.module;
    this.moveTo_func = module.addFunction((_dfuncs, _draw_data, _draw_state, to_x, to_y) => {
      this.collector?.onMoveTo(to_x, to_y);
    }, "viiiffi");
    this.lineTo_func = module.addFunction((_dfuncs, _draw_data, _draw_state, to_x, to_y) => {
      this.collector?.onLineTo(to_x, to_y);
    }, "viiiffi");
    this.quadTo_func = module.addFunction((_dfuncs, _draw_data, _draw_state, c_x, c_y, to_x, to_y) => {
      this.collector?.onQuadTo(c_x, c_y, to_x, to_y);
    }, "viiiffffi");
    this.cubicTo_func = module.addFunction((_dfuncs, _draw_data, _draw_state, c1_x, c1_y, c2_x, c2_y, to_x, to_y) => {
      this.collector?.onCubicTo(c1_x, c1_y, c2_x, c2_y, to_x, to_y);
    }, "viiiffffffi");
    this.closePath_func = module.addFunction((_dfuncs, _draw_data, _draw_state) => {
      this.collector?.onClosePath();
    }, "viiii");
    this.drawFuncsPtr = module.exports.hb_draw_funcs_create();
    module.exports.hb_draw_funcs_set_move_to_func(this.drawFuncsPtr, this.moveTo_func, 0, 0);
    module.exports.hb_draw_funcs_set_line_to_func(this.drawFuncsPtr, this.lineTo_func, 0, 0);
    module.exports.hb_draw_funcs_set_quadratic_to_func(this.drawFuncsPtr, this.quadTo_func, 0, 0);
    module.exports.hb_draw_funcs_set_cubic_to_func(this.drawFuncsPtr, this.cubicTo_func, 0, 0);
    module.exports.hb_draw_funcs_set_close_path_func(this.drawFuncsPtr, this.closePath_func, 0, 0);
  }
  getDrawFuncsPtr() {
    if (!this.drawFuncsPtr) {
      throw new Error("Draw functions not initialized");
    }
    return this.drawFuncsPtr;
  }
  destroy(font) {
    if (!font || !font.module || !font.hb) {
      return;
    }
    const module = font.module;
    try {
      if (this.drawFuncsPtr) {
        module.exports.hb_draw_funcs_destroy(this.drawFuncsPtr);
        this.drawFuncsPtr = 0;
      }
      if (this.moveTo_func !== null) {
        module.removeFunction(this.moveTo_func);
        this.moveTo_func = null;
      }
      if (this.lineTo_func !== null) {
        module.removeFunction(this.lineTo_func);
        this.lineTo_func = null;
      }
      if (this.quadTo_func !== null) {
        module.removeFunction(this.quadTo_func);
        this.quadTo_func = null;
      }
      if (this.cubicTo_func !== null) {
        module.removeFunction(this.cubicTo_func);
        this.cubicTo_func = null;
      }
      if (this.closePath_func !== null) {
        module.removeFunction(this.closePath_func);
        this.closePath_func = null;
      }
    } catch (error2) {
      logger.warn("Error destroying draw callbacks:", error2);
    }
    this.collector = undefined;
  }
}
var sharedDrawCallbackHandlers = new WeakMap;
function getSharedDrawCallbackHandler(font) {
  const key = font.module;
  const existing = sharedDrawCallbackHandlers.get(key);
  if (existing)
    return existing;
  const handler = new DrawCallbackHandler;
  sharedDrawCallbackHandlers.set(key, handler);
  return handler;
}

class GlyphGeometryBuilder {
  constructor(cache, loadedFont) {
    this.fontId = "default";
    this.cacheKeyPrefix = "default";
    this.emptyGlyphs = new Set;
    this.clusterPositions = [];
    this.clusterContoursScratch = [];
    this.taskScratch = [];
    this.cache = cache;
    this.loadedFont = loadedFont;
    this.tessellator = new Tessellator;
    this.extruder = new Extruder;
    this.clusterer = new BoundaryClusterer;
    this.collector = new GlyphContourCollector;
    this.drawCallbacks = getSharedDrawCallbackHandler(this.loadedFont);
    this.drawCallbacks.createDrawFuncs(this.loadedFont, this.collector);
    this.contourCache = globalContourCache;
    this.wordCache = globalWordCache;
    this.clusteringCache = globalClusteringCache;
  }
  getOptimizationStats() {
    return this.collector.getOptimizationStats();
  }
  setCurveFidelityConfig(config) {
    this.curveFidelityConfig = config;
    this.collector.setCurveFidelityConfig(config);
    this.updateCacheKeyPrefix();
  }
  setCurveSteps(curveSteps) {
    if (curveSteps === undefined || curveSteps === null) {
      this.curveSteps = undefined;
    } else if (!Number.isFinite(curveSteps)) {
      this.curveSteps = undefined;
    } else {
      const stepsInt = Math.round(curveSteps);
      this.curveSteps = stepsInt >= 1 ? stepsInt : undefined;
    }
    this.collector.setCurveSteps(this.curveSteps);
    this.updateCacheKeyPrefix();
  }
  setGeometryOptimization(options) {
    this.geometryOptimizationOptions = options;
    this.collector.setGeometryOptimization(options);
    this.updateCacheKeyPrefix();
  }
  setFontId(fontId) {
    this.fontId = fontId;
    this.updateCacheKeyPrefix();
  }
  updateCacheKeyPrefix() {
    this.cacheKeyPrefix = `${this.fontId}__${this.getGeometryConfigSignature()}`;
  }
  getGeometryConfigSignature() {
    const curveSignature = (() => {
      if (this.curveSteps !== undefined) {
        return `cf:steps:${this.curveSteps}`;
      }
      const distanceTolerance = this.curveFidelityConfig?.distanceTolerance ?? DEFAULT_CURVE_FIDELITY.distanceTolerance;
      const angleTolerance = this.curveFidelityConfig?.angleTolerance ?? DEFAULT_CURVE_FIDELITY.angleTolerance;
      return `cf:${distanceTolerance.toFixed(4)},${angleTolerance.toFixed(4)}`;
    })();
    const enabled = this.geometryOptimizationOptions?.enabled ?? DEFAULT_OPTIMIZATION_CONFIG.enabled;
    const areaThreshold = this.geometryOptimizationOptions?.areaThreshold ?? DEFAULT_OPTIMIZATION_CONFIG.areaThreshold;
    return [
      curveSignature,
      `opt:${enabled ? 1 : 0},${areaThreshold.toFixed(4)}`
    ].join("|");
  }
  buildInstancedGeometry(clustersByLine, depth, removeOverlaps, isCFF, scale, separateGlyphs = false, coloredTextIndices) {
    if (isLogEnabled) {
      let wordCount = 0;
      for (let i2 = 0;i2 < clustersByLine.length; i2++) {
        wordCount += clustersByLine[i2].length;
      }
      perfLogger.start("GlyphGeometryBuilder.buildInstancedGeometry", {
        lineCount: clustersByLine.length,
        wordCount,
        depth,
        removeOverlaps
      });
    } else {
      perfLogger.start("GlyphGeometryBuilder.buildInstancedGeometry");
    }
    const tasks = this.taskScratch;
    tasks.length = 0;
    let taskCount = 0;
    let totalVertexFloats = 0;
    let totalNormalFloats = 0;
    let totalIndexCount = 0;
    let vertexCursor = 0;
    const pushTask = (data, px, py, pz) => {
      const vertexStart = vertexCursor;
      let task = tasks[taskCount];
      if (task) {
        task.data = data;
        task.px = px;
        task.py = py;
        task.pz = pz;
        task.vertexStart = vertexStart;
      } else {
        task = { data, px, py, pz, vertexStart };
        tasks[taskCount] = task;
      }
      taskCount++;
      totalVertexFloats += data.vertices.length;
      totalNormalFloats += data.normals.length;
      totalIndexCount += data.indices.length;
      vertexCursor += data.vertices.length / 3;
      return vertexStart;
    };
    const glyphInfos = [];
    const planeBounds = {
      min: { x: Infinity, y: Infinity, z: 0 },
      max: { x: -Infinity, y: -Infinity, z: depth }
    };
    for (let lineIndex = 0;lineIndex < clustersByLine.length; lineIndex++) {
      const line = clustersByLine[lineIndex];
      for (const cluster of line) {
        const clusterX = cluster.position.x;
        const clusterY = cluster.position.y;
        const clusterZ = cluster.position.z;
        const clusterGlyphContours = [];
        for (const glyph of cluster.glyphs) {
          clusterGlyphContours.push(this.getContoursForGlyph(glyph.g));
        }
        let boundaryGroups;
        if (cluster.glyphs.length <= 1) {
          boundaryGroups = [[0]];
        } else {
          const cacheKey = `${this.cacheKeyPrefix}_${cluster.text}`;
          const cached = this.clusteringCache.get(cacheKey);
          let isValid = false;
          if (cached && cached.glyphIds.length === cluster.glyphs.length) {
            isValid = true;
            for (let i2 = 0;i2 < cluster.glyphs.length; i2++) {
              const glyph = cluster.glyphs[i2];
              const cachedPos = cached.positions[i2];
              if (cached.glyphIds[i2] !== glyph.g || cachedPos.x !== (glyph.x ?? 0) || cachedPos.y !== (glyph.y ?? 0)) {
                isValid = false;
                break;
              }
            }
          }
          if (isValid && cached) {
            boundaryGroups = cached.groups;
          } else {
            const glyphCount = cluster.glyphs.length;
            if (this.clusterPositions.length < glyphCount) {
              for (let i2 = this.clusterPositions.length;i2 < glyphCount; i2++) {
                this.clusterPositions.push(new Vec3(0, 0, 0));
              }
            }
            this.clusterPositions.length = glyphCount;
            for (let i2 = 0;i2 < glyphCount; i2++) {
              const glyph = cluster.glyphs[i2];
              const pos = this.clusterPositions[i2];
              pos.x = glyph.x ?? 0;
              pos.y = glyph.y ?? 0;
              pos.z = 0;
            }
            boundaryGroups = this.clusterer.cluster(clusterGlyphContours, this.clusterPositions);
            this.clusteringCache.set(cacheKey, {
              glyphIds: cluster.glyphs.map((g2) => g2.g),
              positions: cluster.glyphs.map((g2) => ({
                x: g2.x ?? 0,
                y: g2.y ?? 0
              })),
              groups: boundaryGroups
            });
          }
        }
        const forceSeparate = separateGlyphs;
        let finalGroups = boundaryGroups;
        if (coloredTextIndices && coloredTextIndices.size > 0) {
          finalGroups = [];
          for (const group of boundaryGroups) {
            if (group.length <= 1) {
              finalGroups.push(group);
            } else {
              const coloredIndices = [];
              const nonColoredIndices = [];
              for (const idx of group) {
                const glyph = cluster.glyphs[idx];
                if (coloredTextIndices.has(glyph.absoluteTextIndex)) {
                  coloredIndices.push(idx);
                } else {
                  nonColoredIndices.push(idx);
                }
              }
              if (coloredIndices.length > 0) {
                finalGroups.push(coloredIndices);
              }
              if (nonColoredIndices.length > 0) {
                finalGroups.push(nonColoredIndices);
              }
            }
          }
        }
        for (const groupIndices of finalGroups) {
          const isOverlappingGroup = groupIndices.length > 1;
          const shouldCluster = isOverlappingGroup && !forceSeparate;
          if (shouldCluster) {
            const subClusterGlyphs = groupIndices.map((i2) => cluster.glyphs[i2]);
            const clusterKey = this.getClusterKey(subClusterGlyphs, depth, removeOverlaps);
            let cachedCluster = this.wordCache.get(clusterKey);
            if (!cachedCluster) {
              const clusterContours = this.clusterContoursScratch;
              let contourIndex = 0;
              const refX = subClusterGlyphs[0].x ?? 0;
              const refY = subClusterGlyphs[0].y ?? 0;
              for (let i2 = 0;i2 < groupIndices.length; i2++) {
                const originalIndex = groupIndices[i2];
                const glyphContours = clusterGlyphContours[originalIndex];
                const glyph = cluster.glyphs[originalIndex];
                const relX = (glyph.x ?? 0) - refX;
                const relY = (glyph.y ?? 0) - refY;
                for (const path of glyphContours.paths) {
                  const points = path.points;
                  const pointCount = points.length;
                  if (pointCount < 3)
                    continue;
                  const isClosed = pointCount > 1 && points[0].x === points[pointCount - 1].x && points[0].y === points[pointCount - 1].y;
                  const end = isClosed ? pointCount - 1 : pointCount;
                  const needed = (end + 1) * 2;
                  let contour = clusterContours[contourIndex];
                  if (!contour || contour.length < needed) {
                    contour = new Array(needed);
                    clusterContours[contourIndex] = contour;
                  } else {
                    contour.length = needed;
                  }
                  let out = 0;
                  for (let k2 = 0;k2 < end; k2++) {
                    const pt = points[k2];
                    contour[out++] = pt.x + relX;
                    contour[out++] = pt.y + relY;
                  }
                  if (out >= 2) {
                    contour[out++] = contour[0];
                    contour[out++] = contour[1];
                  }
                  contourIndex++;
                }
              }
              clusterContours.length = contourIndex;
              cachedCluster = this.tessellateGlyphCluster(clusterContours, depth, isCFF);
              this.wordCache.set(clusterKey, cachedCluster);
            }
            const firstGlyphInGroup = subClusterGlyphs[0];
            const groupPosX = clusterX + (firstGlyphInGroup.x ?? 0);
            const groupPosY = clusterY + (firstGlyphInGroup.y ?? 0);
            const groupPosZ = clusterZ;
            const vertexStart = pushTask(cachedCluster, groupPosX, groupPosY, groupPosZ);
            const clusterVertexCount = cachedCluster.vertices.length / 3;
            for (let i2 = 0;i2 < groupIndices.length; i2++) {
              const originalIndex = groupIndices[i2];
              const glyph = cluster.glyphs[originalIndex];
              const glyphContours = clusterGlyphContours[originalIndex];
              const glyphPosX = clusterX + (glyph.x ?? 0);
              const glyphPosY = clusterY + (glyph.y ?? 0);
              const glyphPosZ = clusterZ;
              const glyphInfo = this.createGlyphInfo(glyph, vertexStart, clusterVertexCount, glyphPosX, glyphPosY, glyphPosZ, glyphContours, depth);
              glyphInfos.push(glyphInfo);
              this.updatePlaneBounds(glyphInfo.bounds, planeBounds);
            }
          } else {
            for (const i2 of groupIndices) {
              const glyph = cluster.glyphs[i2];
              const glyphContours = clusterGlyphContours[i2];
              const glyphPosX = clusterX + (glyph.x ?? 0);
              const glyphPosY = clusterY + (glyph.y ?? 0);
              const glyphPosZ = clusterZ;
              if (glyphContours.paths.length === 0) {
                const glyphInfo2 = this.createGlyphInfo(glyph, 0, 0, glyphPosX, glyphPosY, glyphPosZ, glyphContours, depth);
                glyphInfos.push(glyphInfo2);
                continue;
              }
              const glyphCacheKey = getGlyphCacheKey(this.cacheKeyPrefix, glyph.g, depth, removeOverlaps);
              let cachedGlyph = this.cache.get(glyphCacheKey);
              if (!cachedGlyph) {
                cachedGlyph = this.tessellateGlyph(glyphContours, depth, removeOverlaps, isCFF);
                this.cache.set(glyphCacheKey, cachedGlyph);
              } else {
                cachedGlyph.useCount++;
              }
              const vertexStart = pushTask(cachedGlyph, glyphPosX, glyphPosY, glyphPosZ);
              const glyphInfo = this.createGlyphInfo(glyph, vertexStart, cachedGlyph.vertices.length / 3, glyphPosX, glyphPosY, glyphPosZ, glyphContours, depth);
              glyphInfos.push(glyphInfo);
              this.updatePlaneBounds(glyphInfo.bounds, planeBounds);
            }
          }
        }
      }
    }
    tasks.length = taskCount;
    const vertexArray = new Float32Array(totalVertexFloats);
    const normalArray = new Float32Array(totalNormalFloats);
    const indexArray = new Uint32Array(totalIndexCount);
    let vertexPos = 0;
    let normalPos = 0;
    let indexPos = 0;
    for (let t2 = 0;t2 < tasks.length; t2++) {
      const task = tasks[t2];
      const v2 = task.data.vertices;
      const n2 = task.data.normals;
      const idx = task.data.indices;
      const px = task.px;
      const py = task.py;
      const pz = task.pz;
      const offsetX = px * scale;
      const offsetY = py * scale;
      const offsetZ = pz * scale;
      const vLen = v2.length;
      let outPos = vertexPos;
      for (let j2 = 0;j2 < vLen; j2 += 3) {
        vertexArray[outPos] = v2[j2] * scale + offsetX;
        vertexArray[outPos + 1] = v2[j2 + 1] * scale + offsetY;
        vertexArray[outPos + 2] = v2[j2 + 2] * scale + offsetZ;
        outPos += 3;
      }
      vertexPos = outPos;
      normalArray.set(n2, normalPos);
      normalPos += n2.length;
      const vertexStart = task.vertexStart;
      const idxLen = idx.length;
      let outIndexPos = indexPos;
      for (let j2 = 0;j2 < idxLen; j2++) {
        indexArray[outIndexPos++] = idx[j2] + vertexStart;
      }
      indexPos = outIndexPos;
    }
    perfLogger.end("GlyphGeometryBuilder.buildInstancedGeometry");
    planeBounds.min.x *= scale;
    planeBounds.min.y *= scale;
    planeBounds.min.z *= scale;
    planeBounds.max.x *= scale;
    planeBounds.max.y *= scale;
    planeBounds.max.z *= scale;
    for (let i2 = 0;i2 < glyphInfos.length; i2++) {
      glyphInfos[i2].bounds.min.x *= scale;
      glyphInfos[i2].bounds.min.y *= scale;
      glyphInfos[i2].bounds.min.z *= scale;
      glyphInfos[i2].bounds.max.x *= scale;
      glyphInfos[i2].bounds.max.y *= scale;
      glyphInfos[i2].bounds.max.z *= scale;
    }
    return {
      vertices: vertexArray,
      normals: normalArray,
      indices: indexArray,
      glyphInfos,
      planeBounds
    };
  }
  getClusterKey(glyphs, depth, removeOverlaps) {
    if (glyphs.length === 0)
      return "";
    const refX = glyphs[0].x ?? 0;
    const refY = glyphs[0].y ?? 0;
    const parts = glyphs.map((g2) => {
      const relX = (g2.x ?? 0) - refX;
      const relY = (g2.y ?? 0) - refY;
      return `${g2.g}:${relX},${relY}`;
    });
    const ids = parts.join("|");
    const roundedDepth = Math.round(depth * 1000) / 1000;
    return `${this.cacheKeyPrefix}_${ids}_${roundedDepth}_${removeOverlaps}`;
  }
  createGlyphInfo(glyph, vertexStart, vertexCount, positionX, positionY, positionZ, contours, depth) {
    return {
      textIndex: glyph.absoluteTextIndex,
      lineIndex: glyph.lineIndex,
      vertexStart,
      vertexCount,
      bounds: {
        min: {
          x: contours.bounds.min.x + positionX,
          y: contours.bounds.min.y + positionY,
          z: positionZ
        },
        max: {
          x: contours.bounds.max.x + positionX,
          y: contours.bounds.max.y + positionY,
          z: positionZ + depth
        }
      }
    };
  }
  getContoursForGlyph(glyphId) {
    if (this.emptyGlyphs.has(glyphId)) {
      return {
        glyphId,
        paths: [],
        bounds: {
          min: { x: 0, y: 0 },
          max: { x: 0, y: 0 }
        }
      };
    }
    const key = `${this.cacheKeyPrefix}_${glyphId}`;
    const cached = this.contourCache.get(key);
    if (cached) {
      return cached;
    }
    this.drawCallbacks.setCollector(this.collector);
    this.collector.reset();
    this.collector.beginGlyph(glyphId, 0);
    this.loadedFont.module.exports.hb_font_draw_glyph(this.loadedFont.font.ptr, glyphId, this.drawCallbacks.getDrawFuncsPtr(), 0);
    this.collector.finishGlyph();
    const collected = this.collector.getCollectedGlyphs()[0];
    const contours = collected || {
      glyphId,
      paths: [],
      bounds: {
        min: { x: 0, y: 0 },
        max: { x: 0, y: 0 }
      }
    };
    if (contours.paths.length === 0) {
      this.emptyGlyphs.add(glyphId);
    }
    this.contourCache.set(key, contours);
    return contours;
  }
  tessellateGlyphCluster(contours, depth, isCFF) {
    const processedGeometry = this.tessellator.processContours(contours, true, isCFF, depth !== 0);
    return this.extrudeAndPackage(processedGeometry, depth);
  }
  extrudeAndPackage(processedGeometry, depth) {
    perfLogger.start("Extruder.extrude", {
      depth,
      upem: this.loadedFont.upem
    });
    const extrudedResult = this.extruder.extrude(processedGeometry, depth, this.loadedFont.upem);
    perfLogger.end("Extruder.extrude");
    const vertices = extrudedResult.vertices;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i2 = 0;i2 < vertices.length; i2 += 3) {
      const x2 = vertices[i2];
      const y2 = vertices[i2 + 1];
      const z2 = vertices[i2 + 2];
      if (x2 < minX)
        minX = x2;
      if (x2 > maxX)
        maxX = x2;
      if (y2 < minY)
        minY = y2;
      if (y2 > maxY)
        maxY = y2;
      if (z2 < minZ)
        minZ = z2;
      if (z2 > maxZ)
        maxZ = z2;
    }
    const boundsMin = new Vec3(minX, minY, minZ);
    const boundsMax = new Vec3(maxX, maxY, maxZ);
    return {
      geometry: processedGeometry,
      vertices: extrudedResult.vertices,
      normals: extrudedResult.normals,
      indices: extrudedResult.indices,
      bounds: { min: boundsMin, max: boundsMax },
      useCount: 1
    };
  }
  tessellateGlyph(glyphContours, depth, removeOverlaps, isCFF) {
    perfLogger.start("GlyphGeometryBuilder.tessellateGlyph", {
      glyphId: glyphContours.glyphId,
      pathCount: glyphContours.paths.length
    });
    const processedGeometry = this.tessellator.process(glyphContours.paths, removeOverlaps, isCFF, depth !== 0);
    perfLogger.end("GlyphGeometryBuilder.tessellateGlyph");
    return this.extrudeAndPackage(processedGeometry, depth);
  }
  updatePlaneBounds(glyphBounds, planeBounds) {
    const pMin = planeBounds.min;
    const pMax = planeBounds.max;
    const gMin = glyphBounds.min;
    const gMax = glyphBounds.max;
    if (gMin.x < pMin.x)
      pMin.x = gMin.x;
    if (gMin.y < pMin.y)
      pMin.y = gMin.y;
    if (gMin.z < pMin.z)
      pMin.z = gMin.z;
    if (gMax.x > pMax.x)
      pMax.x = gMax.x;
    if (gMax.y > pMax.y)
      pMax.y = gMax.y;
    if (gMax.z > pMax.z)
      pMax.z = gMax.z;
  }
  getCacheStats() {
    return this.cache.getStats();
  }
  clearCache() {
    this.cache.clear();
    this.wordCache.clear();
    this.clusteringCache.clear();
    this.contourCache.clear();
  }
}

class TextRangeQuery {
  constructor(text, glyphs) {
    this.text = text;
    this.glyphsByTextIndex = new Map;
    glyphs.forEach((g2) => {
      const existing = this.glyphsByTextIndex.get(g2.textIndex) || [];
      existing.push(g2);
      this.glyphsByTextIndex.set(g2.textIndex, existing);
    });
  }
  execute(options) {
    const ranges = [];
    if (options.byText) {
      ranges.push(...this.findByText(options.byText));
    }
    if (options.byCharRange) {
      ranges.push(...this.findByCharRange(options.byCharRange));
    }
    return ranges;
  }
  findByText(patterns) {
    const ranges = [];
    for (const pattern of patterns) {
      let index = 0;
      while ((index = this.text.indexOf(pattern, index)) !== -1) {
        ranges.push(this.createTextRange(index, index + pattern.length, pattern));
        index += pattern.length;
      }
    }
    return ranges;
  }
  findByCharRange(ranges) {
    return ranges.map((range) => {
      const text = this.text.slice(range.start, range.end);
      return this.createTextRange(range.start, range.end, text);
    });
  }
  createTextRange(start, end, originalText) {
    const relevantGlyphs = [];
    const lineGroups = new Map;
    for (let i2 = start;i2 < end; i2++) {
      const glyphs = this.glyphsByTextIndex.get(i2);
      if (glyphs) {
        for (const glyph of glyphs) {
          relevantGlyphs.push(glyph);
          const lineGlyphs = lineGroups.get(glyph.lineIndex) || [];
          lineGlyphs.push(glyph);
          lineGroups.set(glyph.lineIndex, lineGlyphs);
        }
      }
    }
    const bounds = Array.from(lineGroups.values()).map((lineGlyphs) => this.calculateBounds(lineGlyphs));
    return {
      start,
      end,
      originalText,
      bounds,
      glyphs: relevantGlyphs,
      lineIndices: Array.from(lineGroups.keys()).sort((a2, b2) => a2 - b2)
    };
  }
  calculateBounds(glyphs) {
    if (glyphs.length === 0) {
      return {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 }
      };
    }
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const glyph of glyphs) {
      if (glyph.bounds.min.x < minX)
        minX = glyph.bounds.min.x;
      if (glyph.bounds.min.y < minY)
        minY = glyph.bounds.min.y;
      if (glyph.bounds.min.z < minZ)
        minZ = glyph.bounds.min.z;
      if (glyph.bounds.max.x > maxX)
        maxX = glyph.bounds.max.x;
      if (glyph.bounds.max.y > maxY)
        maxY = glyph.bounds.max.y;
      if (glyph.bounds.max.z > maxZ)
        maxZ = glyph.bounds.max.z;
    }
    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ }
    };
  }
}

class MeshGeometryBuilder {
  constructor(loadedFont, fontId) {
    this.loadedFont = loadedFont;
    this.fontId = fontId;
  }
  setFont(loadedFont, fontId) {
    this.loadedFont = loadedFont;
    this.fontId = fontId;
    this.geometryBuilder = undefined;
  }
  build(layout, options) {
    perfLogger.start("MeshGeometryBuilder.build", {
      textLength: options.text.length
    });
    try {
      if (!this.geometryBuilder) {
        this.geometryBuilder = new GlyphGeometryBuilder(globalGlyphCache, this.loadedFont);
        this.geometryBuilder.setFontId(this.fontId);
      }
      const useCurveSteps = options.curveSteps !== undefined && options.curveSteps !== null && options.curveSteps > 0;
      this.geometryBuilder.setCurveSteps(options.curveSteps);
      this.geometryBuilder.setCurveFidelityConfig(useCurveSteps ? undefined : options.curveFidelity);
      this.geometryBuilder.setGeometryOptimization(options.geometryOptimization);
      const shouldRemoveOverlaps = options.removeOverlaps ?? this.loadedFont.isVariable ?? false;
      let coloredTextIndices;
      let byTextMatches;
      if (options.color && typeof options.color === "object" && !Array.isArray(options.color)) {
        if (options.color.byText || options.color.byCharRange) {
          coloredTextIndices = new Set;
          if (options.color.byText) {
            byTextMatches = [];
            for (const pattern of Object.keys(options.color.byText)) {
              let index = 0;
              while ((index = options.text.indexOf(pattern, index)) !== -1) {
                byTextMatches.push({
                  pattern,
                  start: index,
                  end: index + pattern.length
                });
                for (let i2 = index;i2 < index + pattern.length; i2++) {
                  coloredTextIndices.add(i2);
                }
                index += pattern.length;
              }
            }
          }
          if (options.color.byCharRange) {
            for (const range of options.color.byCharRange) {
              for (let i2 = range.start;i2 < range.end; i2++) {
                coloredTextIndices.add(i2);
              }
            }
          }
        }
      }
      const shapedResult = this.geometryBuilder.buildInstancedGeometry(layout.clustersByLine, layout.layoutData.depth, shouldRemoveOverlaps, this.loadedFont.metrics.isCFF, layout.layoutData.pixelsPerFontUnit, options.perGlyphAttributes ?? false, coloredTextIndices);
      const result = this.finalizeGeometry(shapedResult.vertices, shapedResult.normals, shapedResult.indices, shapedResult.glyphInfos, shapedResult.planeBounds, options, options.text, byTextMatches);
      if (options.perGlyphAttributes) {
        const glyphAttrs = this.createGlyphAttributes(result.vertices.length / 3, result.glyphs);
        result.glyphAttributes = glyphAttrs;
      }
      return result;
    } finally {
      perfLogger.end("MeshGeometryBuilder.build");
    }
  }
  getCacheSize() {
    return this.geometryBuilder?.getCacheStats().size ?? 0;
  }
  clearCache() {
    this.geometryBuilder?.clearCache();
  }
  reset() {
    this.geometryBuilder = undefined;
    this.textLayout = undefined;
  }
  finalizeGeometry(vertices, normals, indices, glyphInfoArray, planeBounds, options, originalText, byTextMatches) {
    const { layout = {} } = options;
    const { width, align = layout.direction === "rtl" ? "right" : "left" } = layout;
    if (!this.textLayout) {
      this.textLayout = new TextLayout(this.loadedFont);
    }
    const alignmentResult = this.textLayout.computeAlignmentOffset({
      width,
      align,
      planeBounds
    });
    const offset = alignmentResult.offset;
    planeBounds.min.x = alignmentResult.adjustedBounds.min.x;
    planeBounds.max.x = alignmentResult.adjustedBounds.max.x;
    if (offset !== 0) {
      for (let i2 = 0;i2 < vertices.length; i2 += 3) {
        vertices[i2] += offset;
      }
      for (let i2 = 0;i2 < glyphInfoArray.length; i2++) {
        glyphInfoArray[i2].bounds.min.x += offset;
        glyphInfoArray[i2].bounds.max.x += offset;
      }
    }
    let colors;
    let coloredRanges;
    if (options.color) {
      const colorResult = this.applyColorSystem(vertices, glyphInfoArray, options.color, options.text, byTextMatches);
      colors = colorResult.colors;
      coloredRanges = colorResult.coloredRanges;
    }
    const optimizationStats = this.geometryBuilder.getOptimizationStats();
    const trianglesGenerated = indices.length / 3;
    const verticesGenerated = vertices.length / 3;
    return {
      vertices,
      normals,
      indices,
      colors,
      glyphs: glyphInfoArray,
      planeBounds,
      stats: {
        trianglesGenerated,
        verticesGenerated,
        pointsRemovedByVisvalingam: optimizationStats.pointsRemovedByVisvalingam,
        originalPointCount: optimizationStats.originalPointCount
      },
      query: (() => {
        let cachedQuery = null;
        return (queryOptions) => {
          if (!originalText) {
            throw new Error("Original text not available for querying");
          }
          if (!cachedQuery) {
            cachedQuery = new TextRangeQuery(originalText, glyphInfoArray);
          }
          return cachedQuery.execute(queryOptions);
        };
      })(),
      coloredRanges,
      glyphAttributes: undefined
    };
  }
  applyColorSystem(vertices, glyphInfoArray, color, originalText, byTextMatches) {
    const vertexCount = vertices.length / 3;
    const colors = new Float32Array(vertexCount * 3);
    const coloredRanges = [];
    if (Array.isArray(color)) {
      for (let i2 = 0;i2 < vertexCount; i2++) {
        const baseIndex = i2 * 3;
        colors[baseIndex] = color[0];
        colors[baseIndex + 1] = color[1];
        colors[baseIndex + 2] = color[2];
      }
      coloredRanges.push({
        start: 0,
        end: originalText.length,
        originalText,
        color,
        bounds: [],
        glyphs: glyphInfoArray,
        lineIndices: [...new Set(glyphInfoArray.map((g2) => g2.lineIndex))]
      });
    } else {
      const defaultColor = color.default || [1, 1, 1];
      for (let i2 = 0;i2 < colors.length; i2 += 3) {
        colors[i2] = defaultColor[0];
        colors[i2 + 1] = defaultColor[1];
        colors[i2 + 2] = defaultColor[2];
      }
      let glyphsByTextIndex;
      if (color.byText && byTextMatches || color.byCharRange) {
        glyphsByTextIndex = new Map;
        for (const glyph of glyphInfoArray) {
          const existing = glyphsByTextIndex.get(glyph.textIndex);
          if (existing) {
            existing.push(glyph);
          } else {
            glyphsByTextIndex.set(glyph.textIndex, [glyph]);
          }
        }
      }
      if (color.byText && byTextMatches && glyphsByTextIndex) {
        for (const match of byTextMatches) {
          const targetColor = color.byText[match.pattern];
          if (!targetColor)
            continue;
          const matchGlyphs = [];
          const lineGroups = new Map;
          for (let i2 = match.start;i2 < match.end; i2++) {
            const glyphs = glyphsByTextIndex.get(i2);
            if (glyphs) {
              for (const glyph of glyphs) {
                matchGlyphs.push(glyph);
                const lineGlyphs = lineGroups.get(glyph.lineIndex);
                if (lineGlyphs) {
                  lineGlyphs.push(glyph);
                } else {
                  lineGroups.set(glyph.lineIndex, [glyph]);
                }
                for (let v2 = 0;v2 < glyph.vertexCount; v2++) {
                  const vertexIndex = (glyph.vertexStart + v2) * 3;
                  if (vertexIndex >= 0 && vertexIndex < colors.length) {
                    colors[vertexIndex] = targetColor[0];
                    colors[vertexIndex + 1] = targetColor[1];
                    colors[vertexIndex + 2] = targetColor[2];
                  }
                }
              }
            }
          }
          const bounds = Array.from(lineGroups.values()).map((lineGlyphs) => this.calculateGlyphBounds(lineGlyphs));
          coloredRanges.push({
            start: match.start,
            end: match.end,
            originalText: match.pattern,
            color: targetColor,
            bounds,
            glyphs: matchGlyphs,
            lineIndices: Array.from(lineGroups.keys()).sort((a2, b2) => a2 - b2)
          });
        }
      }
      if (color.byCharRange && glyphsByTextIndex) {
        for (const range of color.byCharRange) {
          const rangeGlyphs = [];
          const lineGroups = new Map;
          for (let i2 = range.start;i2 < range.end; i2++) {
            const glyphs = glyphsByTextIndex.get(i2);
            if (glyphs) {
              for (const glyph of glyphs) {
                rangeGlyphs.push(glyph);
                const lineGlyphs = lineGroups.get(glyph.lineIndex);
                if (lineGlyphs) {
                  lineGlyphs.push(glyph);
                } else {
                  lineGroups.set(glyph.lineIndex, [glyph]);
                }
                for (let v2 = 0;v2 < glyph.vertexCount; v2++) {
                  const vertexIndex = (glyph.vertexStart + v2) * 3;
                  if (vertexIndex >= 0 && vertexIndex < colors.length) {
                    colors[vertexIndex] = range.color[0];
                    colors[vertexIndex + 1] = range.color[1];
                    colors[vertexIndex + 2] = range.color[2];
                  }
                }
              }
            }
          }
          const bounds = Array.from(lineGroups.values()).map((lineGlyphs) => this.calculateGlyphBounds(lineGlyphs));
          coloredRanges.push({
            start: range.start,
            end: range.end,
            originalText: originalText.slice(range.start, range.end),
            color: range.color,
            bounds,
            glyphs: rangeGlyphs,
            lineIndices: Array.from(lineGroups.keys()).sort((a2, b2) => a2 - b2)
          });
        }
      }
    }
    return { colors, coloredRanges };
  }
  calculateGlyphBounds(glyphs) {
    if (glyphs.length === 0) {
      return {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 }
      };
    }
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const glyph of glyphs) {
      if (glyph.bounds.min.x < minX)
        minX = glyph.bounds.min.x;
      if (glyph.bounds.min.y < minY)
        minY = glyph.bounds.min.y;
      if (glyph.bounds.min.z < minZ)
        minZ = glyph.bounds.min.z;
      if (glyph.bounds.max.x > maxX)
        maxX = glyph.bounds.max.x;
      if (glyph.bounds.max.y > maxY)
        maxY = glyph.bounds.max.y;
      if (glyph.bounds.max.z > maxZ)
        maxZ = glyph.bounds.max.z;
    }
    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ }
    };
  }
  createGlyphAttributes(vertexCount, glyphs) {
    const glyphCenters = new Float32Array(vertexCount * 3);
    const glyphIndices = new Float32Array(vertexCount);
    const glyphLineIndices = new Float32Array(vertexCount);
    const glyphProgress = new Float32Array(vertexCount);
    const glyphBaselineY = new Float32Array(vertexCount);
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i2 = 0;i2 < glyphs.length; i2++) {
      const cx = (glyphs[i2].bounds.min.x + glyphs[i2].bounds.max.x) / 2;
      if (cx < minX)
        minX = cx;
      if (cx > maxX)
        maxX = cx;
    }
    const range = maxX - minX;
    for (let index = 0;index < glyphs.length; index++) {
      const glyph = glyphs[index];
      const centerX = (glyph.bounds.min.x + glyph.bounds.max.x) / 2;
      const centerY = (glyph.bounds.min.y + glyph.bounds.max.y) / 2;
      const centerZ = (glyph.bounds.min.z + glyph.bounds.max.z) / 2;
      const baselineY = glyph.bounds.min.y;
      const progress = range > 0 ? (centerX - minX) / range : 0;
      const start = glyph.vertexStart;
      const end = Math.min(start + glyph.vertexCount, vertexCount);
      if (end <= start)
        continue;
      glyphIndices.fill(index, start, end);
      glyphLineIndices.fill(glyph.lineIndex, start, end);
      glyphProgress.fill(progress, start, end);
      glyphBaselineY.fill(baselineY, start, end);
      for (let v2 = start * 3;v2 < end * 3; v2 += 3) {
        glyphCenters[v2] = centerX;
        glyphCenters[v2 + 1] = centerY;
        glyphCenters[v2 + 2] = centerZ;
      }
    }
    return {
      glyphCenter: glyphCenters,
      glyphIndex: glyphIndices,
      glyphLineIndex: glyphLineIndices,
      glyphProgress,
      glyphBaselineY
    };
  }
}

// node_modules/three-text/dist/three/index.js
function buildThreeResult(layoutHandle, meshPipeline, options) {
  const meshResult = meshPipeline.build(layoutHandle, options);
  const geometry = new BufferGeometry;
  geometry.setAttribute("position", new Float32BufferAttribute(meshResult.vertices, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(meshResult.normals, 3));
  geometry.setIndex(new Uint32BufferAttribute(meshResult.indices, 1));
  if (meshResult.colors) {
    geometry.setAttribute("color", new Float32BufferAttribute(meshResult.colors, 3));
  }
  if (meshResult.glyphAttributes) {
    geometry.setAttribute("glyphCenter", new Float32BufferAttribute(meshResult.glyphAttributes.glyphCenter, 3));
    geometry.setAttribute("glyphIndex", new Float32BufferAttribute(meshResult.glyphAttributes.glyphIndex, 1));
    geometry.setAttribute("glyphLineIndex", new Float32BufferAttribute(meshResult.glyphAttributes.glyphLineIndex, 1));
    geometry.setAttribute("glyphProgress", new Float32BufferAttribute(meshResult.glyphAttributes.glyphProgress, 1));
    geometry.setAttribute("glyphBaselineY", new Float32BufferAttribute(meshResult.glyphAttributes.glyphBaselineY, 1));
  }
  geometry.computeBoundingBox();
  const update = async (newOptions) => {
    const mergedOptions = { ...options };
    for (const key in newOptions) {
      const value = newOptions[key];
      if (value !== undefined) {
        mergedOptions[key] = value;
      }
    }
    if (newOptions.font !== undefined || newOptions.fontVariations !== undefined || newOptions.fontFeatures !== undefined) {
      const newLayout2 = await layoutHandle.update(mergedOptions);
      meshPipeline.setFont(newLayout2.loadedFont, newLayout2.fontId);
      meshPipeline.reset();
      layoutHandle = newLayout2;
      options = mergedOptions;
      return buildThreeResult(layoutHandle, meshPipeline, options);
    }
    const newLayout = await layoutHandle.update(mergedOptions);
    layoutHandle = newLayout;
    options = mergedOptions;
    return buildThreeResult(layoutHandle, meshPipeline, options);
  };
  return {
    geometry,
    glyphs: meshResult.glyphs,
    planeBounds: meshResult.planeBounds,
    stats: meshResult.stats,
    query: meshResult.query,
    coloredRanges: meshResult.coloredRanges,
    getLoadedFont: () => layoutHandle.getLoadedFont(),
    getCacheSize: () => meshPipeline.getCacheSize(),
    clearCache: () => meshPipeline.clearCache(),
    measureTextWidth: (text, letterSpacing) => layoutHandle.measureTextWidth(text, letterSpacing),
    update,
    dispose: () => {
      geometry.dispose();
      layoutHandle.dispose();
    }
  };
}

class Text2 {
  static {
    this.setHarfBuzzPath = Text.setHarfBuzzPath;
  }
  static {
    this.setHarfBuzzBuffer = Text.setHarfBuzzBuffer;
  }
  static {
    this.init = Text.init;
  }
  static {
    this.registerPattern = Text.registerPattern;
  }
  static {
    this.preloadPatterns = Text.preloadPatterns;
  }
  static {
    this.setMaxFontCacheMemoryMB = Text.setMaxFontCacheMemoryMB;
  }
  static {
    this.enableWoff2 = Text.enableWoff2;
  }
  static async create(options) {
    const layoutHandle = await Text.create(options);
    const meshPipeline = new MeshGeometryBuilder(layoutHandle.loadedFont, layoutHandle.fontId);
    return buildThreeResult(layoutHandle, meshPipeline, options);
  }
}

// demo/probe-tmp/probe.ts
var DEFAULT_FONT_URL = "/core/demo/fonts/Arimo-Regular.ttf";
var MONO_FONT_URL = "/core/demo/fonts/Cousine-Regular.ttf";
var DEFAULT_HARFBUZZ_URL = "/core/demo/wasm/hb.wasm";
var size = Number(new URL(location.href).searchParams.get("size") ?? "12.7");
var inkWidth = async (font, text) => {
  const h2 = await Text2.create({
    text,
    font,
    size,
    depth: 0,
    perGlyphAttributes: true,
    removeOverlaps: true,
    layout: { align: "center" }
  });
  h2.geometry.computeBoundingBox();
  const w2 = h2.geometry.boundingBox.max.x - h2.geometry.boundingBox.min.x;
  h2.dispose?.();
  return w2;
};
var inkHeight = async (font, text) => {
  const h2 = await Text2.create({
    text,
    font,
    size,
    depth: 0,
    perGlyphAttributes: true,
    removeOverlaps: true,
    layout: { align: "center" }
  });
  h2.geometry.computeBoundingBox();
  const v2 = h2.geometry.boundingBox.max.y - h2.geometry.boundingBox.min.y;
  h2.dispose?.();
  return v2;
};
var run = async () => {
  Text2.setHarfBuzzPath(DEFAULT_HARFBUZZ_URL);
  const out = {};
  for (const [name, font] of [["mono", MONO_FONT_URL], ["arimo", DEFAULT_FONT_URL]]) {
    const w10 = await inkWidth(font, "x".repeat(10));
    const w40 = await inkWidth(font, "x".repeat(40));
    const line = "self.play(Create(cylinder))";
    const wLine = await inkWidth(font, line);
    out[name] = {
      advance_slope: (w40 - w10) / 30,
      line_ink: wLine,
      line_chars: line.length,
      line_per_char: wLine / line.length,
      w_iiii: await inkWidth(font, "iiiiiiiiii"),
      w_MMMM: await inkWidth(font, "MMMMMMMMMM"),
      band_h: await inkHeight(font, line),
      band_h_noDesc: await inkHeight(font, "self.add(cylinder)")
    };
  }
  window.__probe = out;
};
run().catch((e2) => {
  window.__probe = { error: String(e2) };
});
