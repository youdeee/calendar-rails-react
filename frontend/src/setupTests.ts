import "@testing-library/jest-dom";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error jsdom does not implement ResizeObserver
global.ResizeObserver = ResizeObserverStub;

