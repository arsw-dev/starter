import { cleanup } from '@testing-library/react';
import { afterEach } from 'vite-plus/test';

// What Radix calls that jsdom doesn't have: pointer capture and scrolling for
// Select, ResizeObserver for the controls that measure themselves
Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => undefined;
Element.prototype.scrollIntoView = () => undefined;

globalThis.ResizeObserver = class {
  observe = () => undefined;
  unobserve = () => undefined;
  disconnect = () => undefined;
};

// Vitest's globals are off, so Testing Library can't register its own cleanup
afterEach(() => {
  cleanup();
});
