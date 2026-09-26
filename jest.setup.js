import '@testing-library/jest-dom';

const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';

if (hasDom) {
  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  // Mock IntersectionObserver
  global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));

  // Mock CSS custom properties
  Object.defineProperty(window, 'CSSStyleDeclaration', {
    value: class {
      setProperty() {}
      removeProperty() {}
      getPropertyValue() { return '' }
    },
  });
}

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
if (typeof global !== 'undefined') {
  global.localStorage = localStorageMock;
}

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  if (!hasDom) return;
  document.documentElement.removeAttribute('data-theme');
  document.body.innerHTML = '';
});