# Frontend Production Checklist

Use this checklist before shipping the React frontend to production.

## Build and bundle

- Confirm `frontend` builds cleanly with `npm run build`.
- Verify route chunks, vendor chunks, and CSS assets are emitted as expected.
- Ensure console/debugger statements are removed from the production bundle.

## Static delivery

- Serve the app through Nginx or an equivalent static host.
- Cache hashed assets aggressively.
- Serve `index.html` and `service-worker.js` with no-cache headers.
- Verify the service worker registers successfully in production.

## Runtime monitoring

- Set `VITE_ENABLE_MONITORING` and `VITE_MONITORING_ENDPOINT` for the target environment if telemetry ingestion is available.
- Confirm uncaught errors and unhandled promise rejections are recorded.
- Check route transition timings and API request timings in the monitoring backend.

## User experience

- Test the offline banner and offline fallback flow.
- Verify lazy-loaded routes show the loading fallback on first visit.
- Check responsive behavior at mobile, tablet, and desktop breakpoints.
- Validate avatar and hero imagery render correctly with lazy loading and format fallbacks.

## Release verification

- Run the app in a production-like container.
- Smoke test login, mentor discovery, booking, and messaging flows.
- Confirm cache invalidation works after a redeploy.
- Verify the app still opens on refresh for deep links such as `/mentors/:mentorId`.
