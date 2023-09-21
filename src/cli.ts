import chalk from 'chalk';
import { Logger } from '../../logger/src/logger';
import { Application } from '../src';

const app = new Application({
    logger: console,
});

try {
    await app.start();
} catch (error: unknown) {
    console.error(`${chalk.red('Error')}: ${(error as Error).message}`);
    await app.stop();
    process.exit(1);
}