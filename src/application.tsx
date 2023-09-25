import { Logger, z } from '@imlunahey/logger';
import { Server, sleep } from 'bun';
import { existsSync } from 'fs';
import { join as joinPath } from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JsonValue } from 'type-fest';
import { extractPathParams } from './common/extract-params';
import { getPages } from './common/get-pages';
import { Handler, HttpMethod, ResponseBody } from './common/types';
import { getHandlerForURL } from './common/get-handler-for-url';

type Config = {
  web?: {
    port?: number;
    strictMatching?: boolean;
  };
  logger?: {
    debug(message: string, options: Record<string, unknown>): void;
    info(message: string, options: Record<string, unknown>): void;
    error(message: string, options: Record<string, unknown>): void;
  };
};

export class Application {
  private handlers = {
    '*': new Map<string, Handler<any, any, any, any>>(),
    GET: new Map<string, Handler<any, any, any, any>>(),
    POST: new Map<string, Handler<any, any, any, any>>(),
    PUT: new Map<string, Handler<any, any, any, any>>(),
    DELETE: new Map<string, Handler<any, any, any, any>>(),
  };
  private server?: Server;
  private logger: Exclude<Config['logger'], undefined>;
  private state: 'STARTING' | 'STARTED' | 'STOPPING' | 'STOPPED' = 'STOPPED';

  constructor(private config: Config = {}) {
    this.logger = config.logger ?? {
      debug(message, options) {
        console.debug(message, options);
      },
      info(message, options) {
        console.info(message, options);
      },
      error(message, options) {
        console.error(message, options);
      }
    };

    // If we were provided an instance of @ImLunaHey/Logger rebuild it with our types
    if (this.logger instanceof Logger) {
      this.logger = new Logger({
        service: 'xirelta',
        schema: {
          debug: {
            'Registered routes': z.object({
              routes: z.array(z.object({
                path: z.string(),
                method: z.string(),
              }))
            }),
            'Web server closing connections': z.object({
              pendingRequests: z.number(),
              pendingWebSockets: z.number(),
            }),
            // @ts-expect-error using private properties
            ...(this.logger.schema?.debug ?? {}),
          },
          info: {
            'Web server started': z.object({ port: z.number() }),
            'Web server stopping': z.object({}),
            'Web server stopped': z.object({}),
            // @ts-expect-error using private properties
            ...(this.logger.schema?.info ?? {}),
          },
        }
      });
    }
  }

  private method<StrictMode extends boolean, Method extends HttpMethod | '*', Path extends string, Body extends ResponseBody<StrictMode>>(method: Method, path: Path, handler: Handler<StrictMode, Method, Path, Body>) {
    if (this.handlers[method.toUpperCase() as Method].has(path)) throw new Error('This path already has a handler bound');
    this.handlers[method.toUpperCase() as Method].set(path, handler);
  }

  /**
   * ALL methods
   */
  all<StrictMode extends boolean, Path extends string, Body extends ResponseBody<StrictMode>>(path: Path, handler: Handler<StrictMode, '*', Path, Body>) {
    this.method('*', path, handler);
  }

  /**
   * GET method
   */
  get<StrictMode extends boolean, Path extends string, Body extends ResponseBody<StrictMode>>(path: Path, handler: Handler<StrictMode, 'GET', Path, Body>) {
    this.method('GET', path, handler);
  }

  /**
   * POST method
   */
  post<StrictMode extends boolean, Path extends string, Body extends ResponseBody<StrictMode>>(path: Path, handler: Handler<StrictMode, 'POST', Path, Body>) {
    this.method('POST', path, handler);
  }

  /**
   * PUT method
   */
  put<StrictMode extends boolean, Path extends string, Body extends ResponseBody<StrictMode>>(path: Path, handler: Handler<StrictMode, 'PUT', Path, Body>) {
    this.method('PUT', path, handler);
  }

  /**
   * DELETE method
   */
  delete<StrictMode extends boolean, Path extends string, Body extends ResponseBody<StrictMode>>(path: Path, handler: Handler<StrictMode, 'DELETE', Path, Body>) {
    this.method('DELETE', path, handler);
  }

  /**
   * Start the web server on the specified port
   */
  async start() {
    // Don't allow starting the web server multiple times
    if (this.state !== 'STOPPED') throw new Error('Application cannot be started more than once');
    this.state = 'STARTING';

    // Load pages directory
    await this.loadPages();

    // Log what routes we have loaded
    const routes = Object.entries(this.handlers).flatMap(([method, routes]) => [...routes.entries()].map(([path, handler]) => ({ method, path })));
    this.logger.debug('Registered routes', {
      routes,
    });

    // Start web server
    const server = await this.startWebServer();

    return {
      port: server.port,
    };
  }

  private async fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = (request.method as HttpMethod) ?? ('GET' as const).toUpperCase();
    const match = getHandlerForURL(path, this.handlers['*'], this.config.web?.strictMatching) ?? getHandlerForURL(path, this.handlers[method], this.config.web?.strictMatching);
    if (!match)
      return new Response('404 - Page not found', {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });

    const { handler, pattern } = match;
    const params = extractPathParams(path, pattern) ?? {};
    const searchParams = [...url.searchParams.entries()];
    const { cookie, ...safeHeaders } = Object.fromEntries(request.headers.entries());
    const query = searchParams.length === 0 ? {} : Object.fromEntries(searchParams);
    const body = await new Promise<JsonValue | undefined>(async (resolve) => {
      const text = await request.text();
      switch (safeHeaders['content-type']) {
        case 'application/x-www-form-urlencoded':
          try {
            return resolve(Object.fromEntries(text.split(',').map((_) => {
              const [a, b] = _.split('=');
              return [a, b];
            })));
          } catch { }
        default: {
          // Try JSON first
          try {
            return resolve(await request.json() as JsonValue);
          } catch { }
          // Fall back to text
          try {
            return resolve(text);
          } catch {
            return resolve(undefined);
          }
        }
      }
    });
    const response = await Promise.resolve(
      handler({
        params,
        query,
        path,
        headers: {
          cookie,
          ...safeHeaders,
        },
        safeHeaders,
        method,
        body,
      })
    );

    // Custom response
    if (response instanceof Response) return response;

    // JSON response
    if (!React.isValidElement(response)) {
      const stringifiedResponse = typeof response === 'string' ? response : JSON.stringify(response, (key, value) => typeof value === 'function' ? '[function]' : value, 0);
      const contentType = (stringifiedResponse.startsWith('{') && stringifiedResponse.endsWith('}')) ? 'application/json' : 'text/plain';

      return new Response(stringifiedResponse, {
        headers: {
          'Content-Type': contentType,
        },
      });
    }

    // JSX response
    const Node = typeof response === 'function' ? response : () => response;
    return new Response(renderToStaticMarkup(<Node />), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  }

  private async startWebServer() {
    // Get web server port, if none is provided try the env PORT, if that fails fall back to a random port
    const port = this.config.web?.port ?? process.env.PORT ?? 0;

    this.server = Bun.serve({
      port,
      fetch: async (request) => {
        return await this.fetch(request);
      }
    });

    process.on('SIGINT', async () => {
      await this.stop();
      process.exit(0);
    });

    this.state = 'STARTED';
    this.logger.info('Web server started', {
      port: this.server.port,
    });

    return this.server;
  }

  private getPagesDirectory(): string | null {
    // Check "./pages", "./src/pages" and lastly "./dist/pages"
    // If none of these exist we don't have a pages directory
    return [joinPath(process.cwd(), 'pages'), joinPath(process.cwd(), 'src/pages'), joinPath(process.cwd(), 'dist/pages')].filter(path => existsSync(path))?.[0] ?? null;
  };

  private async loadPages() {
    // Find pages directory
    const pagesDirectoryPath = this.getPagesDirectory();

    // Add pages to router
    if (pagesDirectoryPath) {
      // Get all the pages in the current directory
      const pages = await getPages(pagesDirectoryPath);

      // Add each page's handler to the matching path
      for (const page of pages) {
        try {
          this.method(page.method, page.path, page.handler);
        } catch (error) {
          this.logger.error('Failed registering page', {
            page,
            error,
          });
        }
      }
    }
  }

  /**
   * Stop the web server
   */
  async stop() {
    if (this.state !== 'STARTED') return;
    this.state = 'STOPPING';

    this.logger.info('Web server stopping', {});

    return new Promise<void>(async resolve => {
      this.server?.stop(true);
      while ((this.server?.pendingRequests ?? 0) + (this.server?.pendingWebSockets ?? 0) > 1) {
        this.logger.debug('Web server closing connections', {
          pendingRequests: this.server?.pendingRequests,
          pendingWebSockets: this.server?.pendingWebSockets,
        });
        await sleep(100);
      }

      this.logger.info('Web server stopped', {});
      this.state = 'STOPPED';

      resolve();
    });
  }
}
