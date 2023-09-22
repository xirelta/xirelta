import { readdirSync, statSync } from 'fs';
import { join as joinPath } from 'path';

export const getAllFiles = (directoryPath: string, arrayOfFiles: string[] = []) => {
    for (const filePath of readdirSync(directoryPath)) {
        // Directory
        if (statSync(joinPath(directoryPath, filePath)).isDirectory()) arrayOfFiles = getAllFiles(joinPath(directoryPath, filePath), arrayOfFiles);
        // File
        else arrayOfFiles.push(joinPath(directoryPath, filePath));
    }

    return arrayOfFiles;
};
