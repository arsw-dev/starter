export default {
  fetch() {
    return new Response('hello world!');
  },
} satisfies ExportedHandler<Env>;
