import { ReactNode } from 'react';
import { JsonValue, Simplify } from 'type-fest';
import { ExtractParams } from './extract-params';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

type MaybePromise<T> = T | Promise<T>;

export type Handler<Method extends HttpMethod | '*', Path extends string, StrictMode extends boolean = false> = (request: {
    params?: Simplify<ExtractParams<Path>>;
    query?: Simplify<Record<string, unknown>>;
    path: Path;
    method: Method;
    headers: Simplify<Record<string, unknown>>;
    safeHeaders: Simplify<Record<string, unknown>>;
    body?: JsonValue;
}) => Simplify<MaybePromise<ReactNode> | MaybePromise<Response> | MaybePromise<StrictMode extends true ? JsonValue : unknown>>;
