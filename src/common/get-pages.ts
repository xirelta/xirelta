import '@total-typescript/ts-reset';
import { getAllFiles } from './get-all-files';
import { stripTrailingSlash } from './strip-trailing-slash';
import { ExtractParams } from './extract-params';
import { Handler } from './types';

type Page<Path extends string> = {
    path: string;
    handler: Handler<ExtractParams<Path>>;
};

const paramRouteRegex = /\[([a-z0-9_\-]*)\]/g;

export const getPages = async <Directory extends string>(directory: Directory): Promise<Page<Directory>[]> => {
    const files = getAllFiles(directory);
    return await Promise.all(files.map(async filePath => {
        const routePath = filePath
            // Remove the initial directory
            // /Users/luna/code/random-project/src/pages/nested/[directory]/in/[here]/index.tsx -> /nested/:directory/in/:here/index.tsx
            // /Users/luna/code/random-project/src/pages/nested/[directory]/in/[here]/about.tsx -> /nested/:directory/in/:here/about.tsx
            // /Users/luna/code/random-project/src/pages/index.tsx -> /index.tsx
            // /Users/luna/code/random-project/src/pages/about.tsx -> /about.tsx
            .replace(directory, '')
            // Convert params from "[this]" to ":this"
            // /nested/[directory]/in/[here]/index.tsx -> /nested/:directory/in/:here/index.tsx
            // /nested/[directory]/in/[here]/about.tsx -> /nested/:directory/in/:here/about.tsx
            // /index.tsx -> /index.tsx
            // /about.tsx -> /about.tsx
            .replace(paramRouteRegex, (match, capturedString) => capturedString ? `:${capturedString}` : match)
            // Remove file extension
            // /nested/:directory/in/:here/index.tsx -> /nested/:directory/in/:here/index
            // /nested/:directory/in/:here/about.tsx -> /nested/:directory/in/:here/about
            // /index.tsx -> /index
            // /about.tsx -> /about
            .replace(/\..+$/, '')
            // Remove index
            // /nested/:directory/in/:here/index -> /nested/:directory/in/:here/
            // /nested/:directory/in/:here/about -> /nested/:directory/in/:here/about
            // /index -> /
            // /about -> /about
            .replace(/\/index$/, '/')
            // Remove trailing slash
            // /nested/:directory/in/:here/ -> /nested/:directory/in/:here
            // /nested/:directory/in/:here/about -> /nested/:directory/in/:here/about
            // /index -> /
            // /about -> /about
            .replace(/.*/, stripTrailingSlash);

        const handler = await import(filePath).then(_ => _.default as Handler<ExtractParams<Directory>>).catch(() => null);

        if (!handler) return;

        return {
            path: routePath,
            handler,
        } satisfies Page<Directory>;
    })).then(results => results.filter(Boolean));
};
