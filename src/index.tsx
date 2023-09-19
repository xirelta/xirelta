import { Logger, z } from '@imlunahey/logger';
import { Server, sleep } from 'bun';
import { existsSync, readdirSync, statSync } from 'fs';
import { basename, dirname, join as joinPath } from 'path';
import React from 'react';
import { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JsonValue, Simplify } from 'type-fest';

type ExtractParam<Path, NextPart> = Path extends `:${infer Param}` ? Record<Param, string> & NextPart : NextPart;

type ExtractParams<Path> = Path extends `${infer Segment}/${infer Rest}` ? ExtractParam<Segment, ExtractParams<Rest>> : ExtractParam<Path, {}>;

const extractPathParams = <T extends string>(path: string, pattern: T): ExtractParams<T> | undefined => {
  const paramNames = (pattern.match(/:[^/]+/g) || []).map((param) => param.slice(1));
  const regexPattern = pattern
    .replace(/:[^/]+/g, '([^/]+)')
    .replace(/\*/g, '(.*)') // Replace * with (.*) to capture wildcard segments
    .replace(/\//g, '\\/');
  const regex = new RegExp(`^${regexPattern}$`);
  const match = path.match(regex);

  if (!match) return;
  if (paramNames.length === 0) return;

  let params: any = {};
  paramNames.forEach((name, index) => {
    params[name] = match[index + 1];
  });

  return params;
};

const matchesPattern = (url: string, pattern: string) => {
  const regexPattern = pattern
    .replace(/:[^/]+/g, '([^/]+)')
    .replace(/\*/g, '.*') // Replace * with .* to match multiple segments
    .replace(/\//g, '\\/');
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(url);
};

type Config = {
  web?: {
    port?: number;
    strictMatching?: boolean;
  };
  logger?: {
    debug(message: string, options: Record<string, unknown>): void;
    info(message: string, options: Record<string, unknown>): void;
  };
};

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type Handler<Params extends Record<string, unknown> = Record<string, unknown>, Method extends HttpMethod = HttpMethod> = (request: {
  params?: Simplify<Params>;
  query?: Record<string, unknown>;
  path: string;
  method: Method;
  body?: JsonValue;
}) => ReactNode | Response | JsonValue;

const stripTrailingSlash = (string: string) => {
  if (string.length === 1) return string;
  return string.endsWith('/') ? string.slice(0, -1) : string;
};

const getHandlerForURL = (url: string, routeMap: Map<string, Handler>, strictMatching = false) => {
  for (const [pattern, handler] of routeMap.entries()) {
    if (strictMatching) {
      if (matchesPattern(url, pattern)) {
        return {
          handler,
          pattern,
        };
      }
    } else if (matchesPattern(stripTrailingSlash(url), pattern) || matchesPattern(stripTrailingSlash(url) + '/', pattern)) {
      return {
        handler,
        pattern,
      };
    }
  }
  return null;
};

const getAllFiles = (directoryPath: string, arrayOfFiles: string[] = []) => {
  for (const filePath of readdirSync(directoryPath)) {
    // Directory
    if (statSync(joinPath(directoryPath, filePath)).isDirectory()) arrayOfFiles = getAllFiles(joinPath(directoryPath, filePath), arrayOfFiles);
    // File
    else {
      // Only allow js, ts and tsx
      const fileName = basename(filePath);
      if (fileName === 'page.js' || filePath === 'page.ts' || filePath === 'page.tsx') arrayOfFiles.push(joinPath(directoryPath, filePath));
    }
  }

  return arrayOfFiles;
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
            // @ts-expect-error using private properties
            ...(this.logger.schema?.debug ?? {}),
          },
          info: {
            'Web server started': z.object({ port: z.number() }),
            'Web server stopping': z.object({
              pendingRequests: z.number(),
              pendingWebSockets: z.number(),
            }),
            'Web server stopped': z.object({}),
            // @ts-expect-error using private properties
            ...(this.logger.schema?.info ?? {}),
          },
        }
      });
    }
  }

  private method<Path extends string, Method extends HttpMethod>(method: HttpMethod | '*', path: Path, handler: Handler<ExtractParams<Path>, Method>) {
    if (this.handlers[method].has(path)) throw new Error('This path already has a handler bound');
    this.logger.debug('Registering route', { method, path });
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

    // Get web server port, if none is provided try the env PORT, if that fails fall back to a random port
    const port = this.config.web?.port ?? process.env.PORT ?? 0;

    // Check if pages directory exists in the current directory
    const pagesDirectoryPath = joinPath(dirname(process.argv[1]), 'pages');
    const pagesExists = existsSync(pagesDirectoryPath);

    // Add pages routes to router
    if (pagesExists) {
      // Get all the routes in the current directory
      const routes = getAllFiles(pagesDirectoryPath);

      // Add each file as a handler for the matching path
      for (const route of routes) {
        try {
          const fileName = basename(route);
          const routePath = stripTrailingSlash(route.replace(pagesDirectoryPath, '').replace(fileName, ''));
          const handler = await import(route).then(_ => _.default);
          this.method('*', routePath, handler);
        } catch { }
      }
    }

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
            resolve(await request.json());
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
              JSON.parse(String(response));
              return 'application/json';
            } catch { }

            return 'text/plain';
          })();

          return new Response(String(response), {
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
  }

  /**
   * Stop the web server
   */
  async stop() {
    if (this.state !== 'STARTED') return;

    this.logger.info('Web server stopping', {
      pendingRequests: this.server?.pendingRequests,
      pendingWebSockets: this.server?.pendingWebSockets,
    });

    return new Promise<void>(async resolve => {
      this.server?.stop();
      while ((this.server?.pendingRequests ?? 0) + (this.server?.pendingWebSockets ?? 0) > 1) {
        this.logger.debug('Web server stopping', {
          pendingRequests: this.server?.pendingRequests,
          pendingWebSockets: this.server?.pendingWebSockets,
        });
        await sleep(1_000);
      }

      this.logger.info('Web server stopped', {});

      resolve();
    });
  }
}
