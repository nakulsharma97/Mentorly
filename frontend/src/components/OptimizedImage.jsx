import { useEffect, useRef, useState } from 'react';
import { createIntersectionObserver } from '../utils/performanceUtils';

const TRANSPARENT_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/4U8AAAAASUVORK5CYII=';
const WEBP_TEST_PIXEL = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA=';

const supportsWebpImage = () => new Promise((resolve) => {
  const image = new Image();
  image.onload = () => resolve(image.width > 0 && image.height > 0);
  image.onerror = () => resolve(false);
  image.src = WEBP_TEST_PIXEL;
});

export default function OptimizedImage({
  src,
  alt,
  className = '',
  webpSrc,
  loading = 'lazy',
  decoding = 'async',
  priority = false,
  onError,
  ...rest
}) {
  const imageRef = useRef(null);
  const [isVisible, setIsVisible] = useState(priority || loading === 'eager');
  const [useWebp, setUseWebp] = useState(false);

  useEffect(() => {
    if (!webpSrc || useWebp) {
      return undefined;
    }

    let active = true;
    supportsWebpImage().then((supported) => {
      if (active) {
        setUseWebp(supported);
      }
    });

    return () => {
      active = false;
    };
  }, [useWebp, webpSrc]);

  useEffect(() => {
    if (isVisible || !imageRef.current || typeof window === 'undefined') {
      return undefined;
    }

    const observer = createIntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setIsVisible(true);
        observer.disconnect();
      }
    });

    observer.observe(imageRef.current);

    return () => observer.disconnect();
  }, [isVisible]);

  const resolvedSrc = isVisible ? ((webpSrc && useWebp) ? webpSrc : src) : TRANSPARENT_PIXEL;

  return (
    <img
      ref={imageRef}
      src={resolvedSrc}
      alt={alt}
      className={className}
      loading={priority ? 'eager' : loading}
      decoding={decoding}
      fetchpriority={priority ? 'high' : 'auto'}
      onError={(event) => {
        if (webpSrc && useWebp) {
          setUseWebp(false);
        }
        if (onError) {
          onError(event);
        }
      }}
      {...rest}
    />
  );
}
