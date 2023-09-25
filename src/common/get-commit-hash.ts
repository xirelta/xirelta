import { join as joinPath } from 'path';
import { readFileSync } from 'fs';

export const getHashFromDisk = (directory = joinPath(__dirname, '..')) => {
    try {
        const headPath = joinPath(directory, '.git/HEAD');
        const fileContents = readFileSync(headPath).toString();
        const revision = fileContents.trim().split(/.*[ :]/).at(-1);

        if (!revision?.includes('/')) return revision;
        return readFileSync(joinPath(directory, `.git/${revision}`)).toString().trim();
    } catch { }

    return null;
};

export const getHashFromEnvironment = () => process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? null;

let commitHash: string;
export const getCommitHash = (directory?: string) => {
    if (commitHash) return commitHash;
    commitHash = (getHashFromEnvironment() ?? getHashFromDisk(directory) ?? 'unknown');
    return commitHash;
};
