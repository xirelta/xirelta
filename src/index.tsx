import { Server, sleep } from 'bun';
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
  };
};

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';
type Handler<T extends Record<string, unknown> = Record<string, unknown>, U extends Method = Method> = (request: {
  params?: Simplify<T>;
  path: string;
  method: U;
  body?: JsonValue;
}) => ReactNode | Response | JsonValue;

const getHandlerForURL = (url: string, routeMap: Map<string, Handler>) => {
  for (const [pattern, handler] of routeMap.entries()) {
    if (matchesPattern(url, pattern)) {
      return {
        handler,
        pattern,
      };
    }
  }
  return null;
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

  constructor(private config: Config) {}

  private method<T extends string, U extends Method>(method: Method | '*', path: T, handler: Handler<ExtractParams<T>, U>) {
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
    const port = this.config.web?.port;
    if (!port) throw new Error('Please set config.web.port first');

    this.server = Bun.serve({
      port,
      fetch: async (request) => {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = (request.method as Method) ?? ('GET' as const);
        const match = getHandlerForURL(path, this.handlers['*']) ?? getHandlerForURL(path, this.handlers[method]);
        if (!match)
          return new Response('404 - Page not found', {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
            },
          });

        const { handler, pattern } = match;
        const params = extractPathParams(path, pattern);
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
            } catch {}

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

    console.info(`Web server started http://localhost:${port}`);
  }

  /**
   * Stop the web server
   */
  async stop() {
    return new Promise<void>(async (resolve) => {
      this.server?.stop();
      while ((this.server?.pendingRequests ?? 0) + (this.server?.pendingWebSockets ?? 0) > 1) {
        await sleep(100);
      }

      resolve();
    });
  }
}
