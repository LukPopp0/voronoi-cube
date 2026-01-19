/// <reference types="vite/client" />

// Vite worker import syntax
declare module '*?worker' {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}