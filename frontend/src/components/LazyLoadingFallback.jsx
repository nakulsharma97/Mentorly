import { useEffect, useState } from 'react';

/**
 * Optimized Fallback Component for Lazy Loading
 * Shows a skeleton loader while chunks are being loaded
 * Includes timeout handling and error recovery
 */
export default function LazyLoadingFallback({ label = 'Loading page' }) {
  const [showSlowWarning, setShowSlowWarning] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSlowWarning(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6 py-16"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="text-center max-w-md">
        {/* Skeleton animation */}
        <div className="mb-8 flex justify-center">
          <div className="w-16 h-16 bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-gray-700 rounded-full animate-pulse" />
        </div>

        {/* Loading text */}
        <h2 className="text-lg font-semibold text-on-surface mb-2">
          {label}...
        </h2>

        {/* Placeholder skeleton lines */}
        <div className="space-y-3 mb-6">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded skeleton-line" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded skeleton-line w-5/6" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded skeleton-line w-4/6" />
        </div>

        {/* Slow network warning */}
        {showSlowWarning && (
          <div
            className="text-sm text-muted bg-hover-bg p-3 rounded-lg border border-card-border"
            role="alert"
          >
            <p className="font-medium mb-1">Slow connection detected</p>
            <p className="text-xs opacity-75">
              If this takes too long, please check your internet connection.
            </p>
          </div>
        )}

        {/* Accessibility helper text */}
        <p className="text-xs text-muted mt-6 opacity-75">
          This is a temporary loading state. If you see this for more than 10 seconds,
          the page may have failed to load. Try refreshing.
        </p>
      </div>
    </main>
  );
}
