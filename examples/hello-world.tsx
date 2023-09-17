import chalk from 'chalk';
import { Application } from '../src';

const app = new Application({
  web: {
    port: Number(process.env.PORT ?? '3000'),
  },
});

app.get('/', () => 'hello world');

app.get('/:a/*', (request) => <pre>{JSON.stringify(request, null, 2)}</pre>);

try {
  await app.start();
} catch (error: unknown) {
  console.error(`${chalk.red('Error')}: ${(error as Error).message}`);
  await app.stop();
  process.exit(1);
}
