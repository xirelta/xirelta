import { Logger, z } from '@imlunahey/logger';
import { Server, sleep } from 'bun';
import { existsSync } from 'fs';
import { join as joinPath } from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JsonValue, PartialDeep } from 'type-fest';
import { extractPathParams } from './common/extract-params';
import { getPages } from './common/get-pages';
import { ErrorHandler, Handler, HttpMethod, ResponseBody } from './common/types';
import { getHandlerForURL } from './common/get-handler-for-url';
import { SimplifyDeep } from 'type-fest/source/merge-deep';
import queryString from 'query-string';
import semver from 'semver';
import { getCommitHash } from './common/get-commit-hash';

type WebConfig = {
  port: number;
  strictMatching: boolean;
  pages?: {
    directory?: string;
  }
  healthCheck: boolean;
  errorHandler?: ErrorHandler<any, any, any, any>;
};

type BasicLogger = {
  debug(message: string, options: Record<string, unknown>): void;
  info(message: string, options: Record<string, unknown>): void;
  error(message: string, options: Record<string, unknown>): void;
};

export type Config = {
  web?: SimplifyDeep<PartialDeep<WebConfig>>;
  logger?: BasicLogger;
};

export class Application {
  private handlers = {
    '*': new Map<string, any>(),
    GET: new Map<string, any>(),
    POST: new Map<string, any>(),
    PUT: new Map<string, any>(),
    DELETE: new Map<string, any>(),
  };
  private server?: Server;
  public readonly logger: Exclude<Config['logger'], undefined>;
  private state: 'STARTING' | 'STARTED' | 'STOPPING' | 'STOPPED' = 'STOPPED';
  private config: {
    web: SimplifyDeep<WebConfig>;
    logger?: BasicLogger;
  };

  constructor(config: Config = {}) {
    // Add config
    this.config = {
      ...config,
      web: {
        ...config.web,
        // Get web server port, if none is provided try the env PORT, if that fails fall back to a random port
        port: Number(config.web?.port ?? process.env.PORT ?? 0),
        // By default mount a health check at /.well-known/health
        healthCheck: config.web?.healthCheck ?? true,
        // By default allow matching a URL with and without a trailing slash
        strictMatching: config.web?.strictMatching ?? false,
      },
    };

    // Setup app-wide logger
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
      type ZErrorType = {
        name: string;
        message: string;
        stack: string;
        cause?: ZErrorType | undefined;
      }
      const ZError: z.ZodType<ZErrorType> = z.lazy(() => z.object({
        name: z.string(),
        message: z.string(),
        stack: z.string(),
        cause: ZError.or(z.undefined()),
      }));
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
          error: {
            'Error in after middleware': z.object({
              error: ZError,
            }),
            // @ts-expect-error using private properties
            ...(this.logger.schema?.error ?? {}),
          }
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
  use<StrictMode extends boolean, Path extends string, Body extends ResponseBody<StrictMode>>(path: Path, handler: Handler<StrictMode, '*', Path, Body>) {
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

    // Get the version of the current application
    const version = await import(`${process.cwd()}/package.json`).then(pkg => semver.parse(pkg.version)?.major).catch(() => 'unknown');
    const releaseId = await import(`${process.cwd()}/package.json`).then(pkg => `${pkg.version}+${getCommitHash(process.cwd())}`).catch(() => 'unknown');

    // If health checks are enabled add them
    // See: https://datatracker.ietf.org/doc/html/draft-inadarei-api-health-check
    if (this.config.web?.healthCheck) this.get('/.well-known/health', () => {
      const fields = {
        version,
        releaseId,
        time: new Date().toISOString(),
      };

      // If the web server isn't started then we're in a failure mode
      if (this.state !== 'STARTED') return new Response(JSON.stringify({
        ...fields,
        status: 'fail',
      }), {
        status: 503,
        headers: {
          'content-type': 'application/health+json',
        },
      });

      // Otherwise all is okay
      return new Response(JSON.stringify({
        ...fields,
        status: 'pass',
      }), {
        status: 200,
        headers: {
          'content-type': 'application/health+json',
        },
      });
    });

    // Load pages directory
    await this.loadPages();

    // Log what routes we have loaded
    const routes = Object.entries(this.handlers).flatMap(([method, routes]) => [...routes.entries()].map(([path, handler]) => ({ method, path })));
    this.logger.debug('Registered routes', {
      routes,
    });

    // Start web server
    const server = await this.startWebServer();

    this.state = 'STARTED';

    return {
      port: server.port,
    };
  }

  private errorResponse(message: string = 'Internal Server Error', code: number = 500) {
    return new Response(`${code} - ${message}`, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  private notFoundResponse() {
    return new Response('404 - Not Found', {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  private async fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = (request.method as HttpMethod) ?? ('GET' as const).toUpperCase();
    const match = getHandlerForURL(path, this.handlers['*'], this.config.web?.strictMatching) ?? getHandlerForURL(path, this.handlers[method], this.config.web?.strictMatching);
    if (!match) return this.notFoundResponse();

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
            return resolve(queryString.parse(`?${text}`, { arrayFormat: 'colon-list-separator' }));
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
    const _request = {
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
      context: {},
    };

    const StopFunctionSymbol = Symbol('StopFunction');
    const StopFunction = async () => StopFunctionSymbol;

    // Loop through all handler before middleware, then the handler itself and lastly the after middleware
    // If any of them return a response we return it and stop going through middleware
    // Note: If stop() is returned at any point we stop processing middleware
    const beforeAndMainHandler = [...handler.before ?? [], handler];
    let response: any = undefined;
    let error: Error | undefined = undefined;
    while (true) {
      const currentHandler = beforeAndMainHandler.shift();
      if (response === StopFunctionSymbol) break;
      if (!currentHandler) break;
      if (error) break;
      try {
        response = await Promise.resolve(currentHandler(_request, StopFunction));
      } catch (responseError: unknown) {
        error = responseError instanceof Error ? responseError : new Error('Unknown Error', { cause: responseError });
      }
    }

    // Now that the before middleware has run and the handler itself has run
    // let's try the after handlers, each of them should run 
    const afterHandlers = handler.after ?? [];
    let afterHandlersDone = undefined;
    while (true) {
      const afterHandler = afterHandlers.shift();
      if (afterHandlersDone === StopFunctionSymbol) break;
      if (!afterHandler) break;
      if (error) break;
      try {
        afterHandlersDone = await Promise.resolve(afterHandler(_request, StopFunction));
      } catch (afterError: unknown) {
        error = afterError instanceof Error ? afterError : new Error('Unknown Error', { cause: afterError });
        this.logger.error('Error in after middleware', {
          error,
        });
      }

      // If we didn't get a response from the before or main handler let the after reply
      // This is useful for people who want a custom 404/error page
      if (!response) response = afterHandlersDone;
    }

    // If we still have no response but do have an error render that out
    if (!response || response === StopFunctionSymbol || error) {
      // Try the handler's error handler first
      try {
        if (handler.error) return handler.error(_request, error);
      } catch { }

      // Try the global error handler
      try {
        if (this.config.web?.errorHandler) return this.config.web?.errorHandler(_request, error);
      } catch { }

      // Fall back to the default error handler
      return this.errorResponse(error instanceof Error ? error.message : 'Internal Server Error');
    }

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
    const renderedNode = renderToStaticMarkup(<Node />);
    const html = renderedNode.startsWith('<html') ? `<!DOCTYPE html>${renderedNode}` : renderedNode;
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  }

  private async startWebServer() {
    const port = this.config.web.port;

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

    this.logger.info('Web server started', {
      port: this.server.port,
    });

    return this.server;
  }

  private getPagesDirectory(): string | null {
    // Check the paths the user provided, "./pages", "./src/pages" and lastly "./dist/pages"
    // If none of these exist we don't have a pages directory
    return [
      this.config.web?.pages?.directory,
      joinPath(process.cwd(), 'pages'),
      joinPath(process.cwd(), 'src/pages'),
      joinPath(process.cwd(), 'dist/pages'),
    ].filter(path => path && existsSync(path))?.[0] ?? null;
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
        await sleep(100);
      }

      this.logger.info('Web server stopped', {});
      this.state = 'STOPPED';

      resolve();
    });
  }
}
