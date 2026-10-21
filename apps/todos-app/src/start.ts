import { createStart } from '@tanstack/react-start';

import { apiErrorAdapter } from './api/api.error.ts';

const startInstance = createStart(() => ({
  serializationAdapters: [apiErrorAdapter],
}));

export { startInstance };
