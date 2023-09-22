import { ReactNode } from 'react';
import { Simplify, JsonValue } from 'type-fest';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type Handler<Path extends string, Params extends Record<string, unknown> = Record<string, unknown>, Method extends HttpMethod | '*' = HttpMethod | '*'> = (request: {
    params?: Simplify<Params>;
    query?: Record<string, unknown>;
    path: Path;
    method: Method;
    headers: Record<string, unknown>;
    safeHeaders: Record<string, unknown>;
    body?: JsonValue;
}) => ReactNode | Response | JsonValue | Promise<ReactNode> | Promise<Response> | Promise<JsonValue>;
