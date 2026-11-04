// Minimal DOMMatrix / ImageData / Path2D polyfills for Node.js serverless
// runtimes (e.g. Vercel) where the native "@napi-rs/canvas" package is not
// available. pdf.js only needs these globals for canvas *rendering*; plain
// text extraction works fine with these stubs. Import this module BEFORE
// anything that loads pdfjs-dist.

const TO_RADIANS = Math.PI / 180;

class PDFDOMMatrix {
  constructor(init) {
    this.a = 1;
    this.b = 0;
    this.c = 0;
    this.d = 1;
    this.e = 0;
    this.f = 0;
    if (typeof init === "string") {
      const match = init.match(/matrix\(\s*(.*?)\s*\)/i);
      if (match) {
        const values = match[1].split(/[\s,]+/).filter(Boolean).map(Number);
        [this.a, this.b, this.c, this.d, this.e, this.f] = values;
      }
    } else if (Array.isArray(init)) {
      [this.a, this.b, this.c, this.d, this.e, this.f] = init;
    }
  }

  get is2D() {
    return true;
  }

  get m11() {
    return this.a;
  }

  set m11(v) {
    this.a = v;
  }

  get m12() {
    return this.b;
  }

  set m12(v) {
    this.b = v;
  }

  get m13() {
    return 0;
  }

  get m14() {
    return 0;
  }

  get m21() {
    return this.c;
  }

  set m21(v) {
    this.c = v;
  }

  get m22() {
    return this.d;
  }

  set m22(v) {
    this.d = v;
  }

  get m23() {
    return 0;
  }

  get m24() {
    return 0;
  }

  get m31() {
    return 0;
  }

  get m32() {
    return 0;
  }

  get m33() {
    return 1;
  }

  get m34() {
    return 0;
  }

  get m41() {
    return this.e;
  }

  set m41(v) {
    this.e = v;
  }

  get m42() {
    return this.f;
  }

  set m42(v) {
    this.f = v;
  }

  get m43() {
    return 0;
  }

  get m44() {
    return 1;
  }

  translate(tx, ty) {
    const m = new PDFDOMMatrix([this.a, this.b, this.c, this.d, this.e, this.f]);
    m.e += tx * m.a + ty * m.c;
    m.f += tx * m.b + ty * m.d;
    return m;
  }

  scale(sx, sy) {
    const m = new PDFDOMMatrix([this.a, this.b, this.c, this.d, this.e, this.f]);
    m.a *= sx;
    m.b *= sy;
    m.c *= sx;
    m.d *= sy;
    return m;
  }

  rotate(angle, originX = 0, originY = 0) {
    const cos = Math.cos(angle * TO_RADIANS);
    const sin = Math.sin(angle * TO_RADIANS);
    const m = new PDFDOMMatrix([cos, sin, -sin, cos, 0, 0]);
    return this.translate(originX, originY).multiply(m).translate(-originX, -originY);
  }

  multiply(other) {
    const { a, b, c, d, e, f } = other;
    return new PDFDOMMatrix([
      this.a * a + this.c * b,
      this.b * a + this.d * b,
      this.a * c + this.c * d,
      this.b * c + this.d * d,
      this.a * e + this.c * f + this.e,
      this.b * e + this.d * f + this.f,
    ]);
  }

  multiplySelf(other) {
    const m = this.multiply(other);
    return this.setTo(m);
  }

  preMultiplySelf(other) {
    const m = other.multiply(this);
    return this.setTo(m);
  }

  invertSelf() {
    const { a, b, c, d, e, f } = this;
    const det = a * d - b * c;
    if (det === 0) return this;
    const ia = d / det;
    const ib = -b / det;
    const ic = -c / det;
    const id = a / det;
    this.a = ia;
    this.b = ib;
    this.c = ic;
    this.d = id;
    this.e = -(ia * e + ic * f);
    this.f = -(ib * e + id * f);
    return this;
  }

  transformPoint(pt) {
    return {
      x: this.a * pt.x + this.c * pt.y + this.e,
      y: this.b * pt.x + this.d * pt.y + this.f,
      z: 0,
      w: 1,
    };
  }

  setTo(m) {
    this.a = m.a;
    this.b = m.b;
    this.c = m.c;
    this.d = m.d;
    this.e = m.e;
    this.f = m.f;
    return this;
  }

  toJSON() {
    return [this.a, this.b, this.c, this.d, this.e, this.f];
  }
}

class PDFImageData {
  constructor(w, h) {
    this.width = w;
    this.height = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }
}

class PDFPath2D {
  addPath() {}
}

if (!globalThis.DOMMatrix) globalThis.DOMMatrix = PDFDOMMatrix;
if (!globalThis.ImageData) globalThis.ImageData = PDFImageData;
if (!globalThis.Path2D) globalThis.Path2D = PDFPath2D;