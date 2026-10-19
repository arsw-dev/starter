import { exports } from 'cloudflare:workers';
import { expect, it } from 'vite-plus/test';

it('answers GET /', async () => {
  const response = await exports.default.fetch('http://todos/');

  expect(response.status).toBe(200);
  expect(await response.text()).toBe('hello world!');
});

it('runs in workerd, not Node', () => {
  expect(navigator.userAgent).toBe('Cloudflare-Workers');
});
