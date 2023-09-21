import { Logger, z } from '../../logger/src/logger';
import { Server, sleep } from 'bun';
import { existsSync } from 'fs';
import { join as joinPath } from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JsonValue } from 'type-fest';
import { ExtractParams, extractPathParams } from './common/extract-params';
import { matchesPattern } from './common/matches-pattern';
import { getPages } from './common/get-pages';
import { Handler, HttpMethod } from './common/types';
import { stripTrailingSlash } from './common/strip-trailing-slash';

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

const getHandlerForURL = (url: string, routeMap: Map<string, Handler>, strictMatching = false) => {
  const matches = [];
  for (const [pattern, handler] of routeMap.entries()) {
    if (strictMatching) {
      if (matchesPattern(url, pattern)) {
        matches.push({
          handler,
          pattern,
        });
      }
    } else if (matchesPattern(stripTrailingSlash(url), pattern) || matchesPattern(stripTrailingSlash(url) + '/', pattern)) {
      matches.push({
        handler,
        pattern,
      });
    }
  }

  // Sort the matches to prioritize more specific (non-parameterized) patterns
  const sortedMatches = matches.sort((a, b) => {
    const aIsParam = a.pattern.includes(":");
    const bIsParam = b.pattern.includes(":");

    // Return the match without the param first
    if (aIsParam && !bIsParam) return 1;
    if (!aIsParam && bIsParam) return -1;

    // If both are the same type, maintain original order
    return 0;
  });

  return sortedMatches[0];
};

export class Application {
  private handlers = {
    '*': new Map(),
    GET: new Map(),
    POST: new Map(),
    PUT: new Map(),
    DELETE: new Map(),
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
            'Registering route': z.object({
              path: z.string(),
              method: z.string(),
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

  private method<Path extends string, Method extends HttpMethod>(method: HttpMethod | '*', path: Path, handler: Handler<ExtractParams<Path>, Method>) {
    this.logger.debug('Registering route', { method, path });
    if (this.handlers[method].has(path)) throw new Error('This path already has a handler bound');
    this.handlers[method].set(path, handler as Handler);
  }

  /**
   * ALL methods
   */
  all<T extends string>(path: T, handler: Handler<ExtractParams<T>, 'GET'>) {
    this.method('*', path, handler);
  }

  /**
   * GET method
   */
  get<T extends string>(path: T, handler: Handler<ExtractParams<T>, 'GET'>) {
    this.method('GET', path, handler);
  }

  /**
   * POST method
   */
  post<T extends string>(path: T, handler: Handler<ExtractParams<T>, 'POST'>) {
    this.method('POST', path, handler);
  }

  /**
   * PUT method
   */
  put<T extends string>(path: T, handler: Handler<ExtractParams<T>, 'PUT'>) {
    this.method('PUT', path, handler);
  }

  /**
   * DELETE method
   */
  delete<T extends string>(path: T, handler: Handler<ExtractParams<T>, 'DELETE'>) {
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

    // Start web server
    const server = await this.startWebServer();

    return {
      port: server.port,
    };
  }

  private async startWebServer() {
    // Get web server port, if none is provided try the env PORT, if that fails fall back to a random port
    const port = this.config.web?.port ?? process.env.PORT ?? 0;

    this.server = Bun.serve({
      port,
      fetch: async (request) => {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = (request.method as HttpMethod) ?? ('GET' as const);
        const match = getHandlerForURL(path, this.handlers['*'], this.config.web?.strictMatching) ?? getHandlerForURL(path, this.handlers[method], this.config.web?.strictMatching);
        if (!match)
          return new Response('404 - Page not found', {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
            },
          });

        const { handler, pattern } = match;
        const params = extractPathParams(path, pattern);
        const searchParams = [...url.searchParams.entries()];
        const query = searchParams.length === 0 ? undefined : Object.fromEntries(searchParams);
        const body = await new Promise<JsonValue | undefined>(async (resolve) => {
          try {
            resolve(await request.json() as JsonValue);
          } catch {
            try {
              resolve((await request.text()) || undefined);
            } catch {
              resolve(undefined);
            }
          }
        });
        const response = await Promise.resolve(
          handler({
            params,
            query,
            path,
            method,
            body,
          })
        );

        // Custom response
        if (response instanceof Response) return response;

        // JSON response
        if (!React.isValidElement(response)) {
          const contentType = (() => {
            try {
              JSON.parse(JSON.stringify(response));
              return 'application/json';
            } catch { }

            return 'text/plain';
          })();

          return new Response(JSON.stringify(response, null, 0), {
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
      },
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
          this.logger.debug('Registering page', { page });
          this.method('*', page.path, page.handler);
        } catch (error) {
          this.logger.error('Failed registering route', {
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
