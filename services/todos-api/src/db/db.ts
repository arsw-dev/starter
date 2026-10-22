import { createDefineModel } from '@arsw/hono-drizzle';

// The one call that sets how every model in this API is stored
const defineModel = createDefineModel();

export { defineModel };
