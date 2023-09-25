import { ReactNode } from 'react';
import { JsonValue, Simplify } from 'type-fest';
import { ExtractParams } from './extract-params';
import { ExtractQuery } from './extract-query';

/**
 * Represents the HTTP methods.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * A value that may or may not be a promise.
 */
export type MaybePromise<T> = T | Promise<T>;

export type OmitNever<T> = { [K in keyof T as T[K] extends never ? never : K]: T[K] };

export type ResponseBody<StrictMode extends boolean = false> = Simplify<MaybePromise<ReactNode> | MaybePromise<Response> | MaybePromise<StrictMode extends true ? JsonValue : unknown>> | MaybePromise<void>;

export type Handler<StrictMode extends boolean, Method extends HttpMethod | '*', Path extends string, T extends ResponseBody<StrictMode>> = {
    before?: Handler<StrictMode, Method, Path, T>[];
    after?: Handler<StrictMode, Method, Path, T>[];
} & ((
    /**
     * The current request.
     */
    request: Simplify<OmitNever<{
        /**
         * Path parameters extracted from the URL.
         */
        params: Simplify<ExtractParams<Path>>;
        /**
         * Query parameters parsed from the URL.
         */
        query: Simplify<ExtractQuery<Path>>;
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
        body: Method extends 'GET' ? undefined : JsonValue;
        /**
         * Shared context within the current request.
         */
        context: Simplify<Record<string, string>>;
    }>>,
    /**
     * Return this function to stop the route from processing.
     */
    stop: () => Promise<Symbol>,
    /**
     * This will be set if an error occurred in this request in an earlier middleware.
     */
    error?: Error,
) => T);
