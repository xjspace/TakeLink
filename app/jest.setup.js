/**
 * Jest 全局 setup
 */

// requestAnimationFrame polyfill for React Native components
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
