import { createStart } from '@tanstack/react-start';

import { startOptions } from '@arsw/start-hono';

const startInstance = createStart(() => startOptions());

export { startInstance };
