export {};

declare global {
  interface Window {
    structuredClone<T>(value: T): T;
  }

  function structuredClone<T>(value: T): T;
}