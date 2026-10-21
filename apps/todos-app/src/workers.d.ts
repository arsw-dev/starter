declare module 'cloudflare:workers' {
  const env: {
    TODOS_API: {
      fetch: (request: Request) => Promise<Response>;
    };
  };

  export { env };
}
