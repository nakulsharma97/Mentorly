/**
 * Performance Utilities for Lazy Loading and Code Splitting
 * Provides helpers for efficient lazy loading, memoization, and performance monitoring
 */

import { lazy } from "react";

/**
 * Enhanced lazy loader with built-in error boundary support
 * Allows preloading of chunks before route navigation
 */
export const lazyWithPreload = (importFunc, displayName) => {
  const Component = lazy(importFunc);
  Component.preload = importFunc;
  if (displayName) {
    Component.displayName = displayName;
  }
  return Component;
};

/**
 * Preload a lazy component chunk
 * Useful for prefetching on user hover or network idle
 */
export const preloadLazyComponent = (Component) => {
  if (typeof Component.preload === "function") {
    Component.preload();
  }
};

/**
 * Request Idle Callback polyfill for browsers that don't support it
 */
export const requestIdleCallbackPolyfill = (callback) => {
  if ("requestIdleCallback" in window) {
    return window.requestIdleCallback(callback);
  }
  const start = Date.now();
  return setTimeout(() => {
    callback({
      didTimeout: false,
      timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
    });
  }, 1);
};

/**
 * Cancel idle callback
 */
export const cancelIdleCallback = (id) => {
  if ("cancelIdleCallback" in window) {
    window.cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
};

/**
 * Performance monitoring helper
 * Logs performance metrics for debugging and optimization
 */
export const performanceMarker = (label) => {
  if ("performance" in window && "mark" in window.performance) {
    window.performance.mark(`${label}-start`);
    return () => {
      window.performance.mark(`${label}-end`);
      try {
        window.performance.measure(label, `${label}-start`, `${label}-end`);
        const measure = window.performance.getEntriesByName(label)[0];
        if (process.env.NODE_ENV === "development") {
          console.log(`⏱️ ${label}: ${measure.duration.toFixed(2)}ms`);
        }
      } catch (e) {
        // Silently fail if measure API is not available
      }
    };
  }
  return () => {};
};

/**
 * Intersection Observer helper for lazy loading images and components
 */
export const createIntersectionObserver = (callback, options = {}) => {
  const defaultOptions = {
    root: null,
    rootMargin: "50px",
    threshold: 0.01,
    ...options,
  };

  if ("IntersectionObserver" in window) {
    return new IntersectionObserver(callback, defaultOptions);
  }

  // Fallback for browsers without IntersectionObserver
  return {
    observe: () => {
      // Immediately trigger callback as fallback
      callback([{ isIntersecting: true, target: null }]);
    },
    unobserve: () => {},
    disconnect: () => {},
  };
};

/**
 * Debounce utility for expensive operations
 */
export const debounce = (func, wait = 300) => {
  let timeoutId = null;
  return function debounced(...args) {
    const context = this;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(context, args), wait);
  };
};

/**
 * Throttle utility for frequent events
 */
export const throttle = (func, limit = 1000) => {
  let inThrottle;
  return function throttled(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Memory-efficient memoization for expensive computations
 */
export const memoizeAsync = (asyncFunc, maxSize = 50) => {
  const cache = new Map();
  return async (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = await asyncFunc(...args);
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    cache.set(key, result);
    return result;
  };
};

/**
 * Batch DOM updates to minimize reflows
 */
export const batchDOMUpdates = (updates) => {
  if ("requestAnimationFrame" in window) {
    requestAnimationFrame(() => {
      updates.forEach((update) => update());
    });
  } else {
    updates.forEach((update) => update());
  }
};

/**
 * Check if element is visible in viewport
 */
export const isElementInViewport = (element) => {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <=
      (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
};

export default {
  lazyWithPreload,
  preloadLazyComponent,
  requestIdleCallbackPolyfill,
  cancelIdleCallback,
  performanceMarker,
  createIntersectionObserver,
  debounce,
  throttle,
  memoizeAsync,
  batchDOMUpdates,
  isElementInViewport,
};
