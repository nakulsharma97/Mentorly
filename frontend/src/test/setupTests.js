import "@testing-library/jest-dom/vitest";
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from "./mocks/server";

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// Mock WebSocket to prevent real connections in tests.
// Components like NotificationCenter create WebSocket connections to
// /ws/notifications. Without this mock, Node.js/libuv on Windows can
// crash with "Assertion failed: handle->reqs_pending == 0" because
// unhandled TCP sockets are left dangling when vitest workers exit.
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 3; // CLOSED
    this.CONNECTING = 0;
    this.OPEN = 1;
    this.CLOSING = 2;
    this.CLOSED = 3;
    setTimeout(() => {
      // Trigger onclose immediately to prevent hanging connections
      if (this.onclose) this.onclose({ code: 1000, reason: "Mock closed", wasClean: true });
    }, 0);
  }
  close() {}
  send() {}
  addEventListener() {}
  removeEventListener() {}
}

window.WebSocket = MockWebSocket;

window.scrollTo = () => {};
window.open = () => null;
