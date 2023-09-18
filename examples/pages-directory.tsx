import chalk from 'chalk';
import { Logger, z } from '@imlunahey/logger';
import { Application } from '../src';

const app = new Application({
  logger: new Logger({
    service: 'demo',
  }),
});

try {
  await app.start();
} catch (error: unknown) {
  console.error(`${chalk.red('Error')}: ${(error as Error).message}`);
  await app.stop();
  process.exit(1);
}
