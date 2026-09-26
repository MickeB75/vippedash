// VippeDash — small shared helpers
(function () {
  const VD = (window.VD = window.VD || {});
  const U = {};

  U.lerp = (a, b, t) => a + (b - a) * t;
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.smooth = (t) => t * t * (3 - 2 * t);

  const rgbCache = new Map();
  U.rgb = function (hex) {
    let c = rgbCache.get(hex);
    if (!c) {
      let h = hex.charAt(0) === '#' ? hex.slice(1) : hex;
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      const n = parseInt(h, 16);
      c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      rgbCache.set(hex, c);
    }
    return c;
  };
  U.mix = function (a, b, t) {
    const A = U.rgb(a), B = U.rgb(b);
    return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' + Math.round(A[1] + (B[1] - A[1]) * t) + ',' + Math.round(A[2] + (B[2] - A[2]) * t) + ')';
  };
  U.mixHex = function (a, b, t) {
    const A = U.rgb(a), B = U.rgb(b);
    const h = (v) => ('0' + Math.round(v).toString(16)).slice(-2);
    return '#' + h(A[0] + (B[0] - A[0]) * t) + h(A[1] + (B[1] - A[1]) * t) + h(A[2] + (B[2] - A[2]) * t);
  };
  U.rgba = function (hex, a) {
    const c = U.rgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  };

  // deterministic PRNG (mulberry32)
  U.rng = function (seed) {
    let s = seed | 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.hash = function (n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  VD.U = U;
})();
