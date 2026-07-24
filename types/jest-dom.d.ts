// Registers the jest-dom matcher types (toBeInTheDocument, toHaveClass, ...)
// with TypeScript. jest.setup.js imports the library at runtime, but it is a
// .js file, so its import never pulls in the module augmentation and every
// matcher shows up as a TS2339 error during `tsc --noEmit`.
import '@testing-library/jest-dom';
