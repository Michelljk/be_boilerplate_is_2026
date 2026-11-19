import { ConfigService } from '@nestjs/config';
import { createApplication } from './bootstrap.js';
import type { EnvConfig } from '@Config';
const app = await createApplication();
const config = app.get(ConfigService<EnvConfig, true>);
await app.listen(config.get('PORT', { infer: true }), '0.0.0.0');
