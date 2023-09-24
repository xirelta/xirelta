import { ReactNode } from 'react';
import { JsonValue, Simplify } from 'type-fest';
import { ExtractParams } from './extract-params';

/**
 * Represents the HTTP methods.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * A value that may or may not be a promise.
 */
export type MaybePromise<T> = T | Promise<T>;

export type ResponseBody<StrictMode extends boolean = false> = Simplify<MaybePromise<ReactNode> | MaybePromise<Response> | MaybePromise<StrictMode extends true ? JsonValue : unknown>>;

export type Handler<StrictMode extends boolean, Method extends HttpMethod | '*', Path extends string, Body extends ResponseBody<StrictMode>> = (request: {
    /**
     * Path parameters extracted from the URL.
     */
    params?: Simplify<ExtractParams<Path>>;
    /**
     * Query parameters parsed from the URL.
     */
    query?: Simplify<Record<string, unknown>>;
    /**
     * The request path.
     */
    path: Path;
    /**
     * The HTTP method of the request.
     */
    method: Method;
    /**
     * The headers included in the request.
     */
    headers: Simplify<Record<string, string>>;
    /**
     * A subset of headers considered safe.
     */
    safeHeaders: Simplify<Record<string, string>>;
    /**
     * The request body, if present.
     */
    body?: JsonValue;
}) => Simplify<Body>;
