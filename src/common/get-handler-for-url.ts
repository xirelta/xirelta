import { matchesPattern } from './matches-pattern';
import { stripTrailingSlash } from './strip-trailing-slash';
import { Handler } from './types';

export const getHandlerForURL = (url: string, routeMap: Map<string, Handler<string>>, strictMatching = false) => {
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
