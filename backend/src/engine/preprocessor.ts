/**
 * Structurizr DSL Preprocessor.
 * Resolves !include directives across virtual workspace files, supporting
 * relative path resolution, directory inclusion, circular include detection,
 * and mapping parsed line numbers back to their originating source file and line.
 */

import { ParseError } from './parser.js';

export interface SourceLineMapping {
  file: string;
  originalLine: number;
}

export interface PreprocessResult {
  fullDsl: string;
  lineMap: SourceLineMapping[];
}

/**
 * Normalizes a file path by removing leading/trailing slashes and resolving . and .. segments.
 */
export function normalizePath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/');
  const stack: string[] = [];

  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (stack.length > 0 && stack[stack.length - 1] !== '..') {
        stack.pop();
      } else {
        stack.push('..');
      }
    } else {
      stack.push(part);
    }
  }

  return stack.join('/');
}

/**
 * Resolves a target path relative to the directory containing currentFile.
 */
export function resolveRelativePath(currentFile: string, targetPath: string): string {
  const cleanTarget = targetPath.trim().replace(/^['"]|['"]$/g, '');
  const dirParts = currentFile.replace(/\\/g, '/').split('/');
  dirParts.pop(); // Remove file name, keep directory
  const baseDir = dirParts.join('/');

  if (!baseDir) {
    return normalizePath(cleanTarget);
  }

  return normalizePath(`${baseDir}/${cleanTarget}`);
}

/**
 * Recursively preprocesses DSL files starting from an entry point.
 */
export function preprocessWorkspace(
  entryFile: string = 'workspace.dsl',
  files: Record<string, string>,
  callStack: string[] = []
): PreprocessResult {
  const normalizedEntry = normalizePath(entryFile);

  if (callStack.includes(normalizedEntry)) {
    const cycle = [...callStack, normalizedEntry].join(' -> ');
    throw new ParseError(`Circular !include detected: ${cycle}`, 1, 1);
  }

  const content = files[normalizedEntry];
  if (content === undefined) {
    throw new ParseError(`File not found: '${normalizedEntry}'`, 1, 1);
  }

  const currentStack = [...callStack, normalizedEntry];
  const rawLines = content.split(/\r?\n/);
  const resultLines: string[] = [];
  const lineMap: SourceLineMapping[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const originalLineNum = i + 1;
    const trimmed = line.trim();

    // Match empty !include line
    if (/^!include\s*$/.test(trimmed)) {
      throw new ParseError(
        `Expected file path or directory after !include`,
        originalLineNum,
        line.indexOf('!include') + 1
      );
    }

    // Match !include <path>
    const includeMatch = trimmed.match(/^!include\s+([^\s#]+)/);
    if (includeMatch) {
      const target = includeMatch[1].replace(/^['"]|['"]$/g, '');
      const isDirectory = target.endsWith('/') || !target.includes('.');

      if (isDirectory) {
        // Directory include: find all matching files in that folder
        const normalizedDir = normalizePath(resolveRelativePath(normalizedEntry, target));
        const dirPrefix = normalizedDir ? `${normalizedDir}/` : '';
        const matchingFiles = Object.keys(files)
          .map((f) => normalizePath(f))
          .filter(
            (f) =>
              f.startsWith(dirPrefix) &&
              f.endsWith('.dsl') &&
              !f.slice(dirPrefix.length).includes('/') // Only immediate files in directory
          )
          .sort();

        if (matchingFiles.length === 0) {
          resultLines.push(`// !include ${target} (0 files found)`);
          lineMap.push({ file: normalizedEntry, originalLine: originalLineNum });
        } else {
          for (const subFile of matchingFiles) {
            try {
              const subResult = preprocessWorkspace(subFile, files, currentStack);
              const subLines = subResult.fullDsl.split(/\r?\n/);
              for (let j = 0; j < subLines.length; j++) {
                resultLines.push(subLines[j]);
                lineMap.push(subResult.lineMap[j] || { file: subFile, originalLine: j + 1 });
              }
            } catch (err: any) {
              if (err instanceof ParseError && err.line === 1 && !err.message.includes('Line')) {
                throw new ParseError(`In ${normalizedEntry}:${originalLineNum}: ${err.message}`, originalLineNum, 1);
              }
              throw err;
            }
          }
        }
      } else {
        const resolvedPath = resolveRelativePath(normalizedEntry, target);
        if (files[resolvedPath] === undefined) {
          throw new ParseError(
            `Included file not found: '${target}' (resolved to '${resolvedPath}')`,
            originalLineNum,
            line.indexOf('!include') + 1
          );
        }

        try {
          const subResult = preprocessWorkspace(resolvedPath, files, currentStack);
          const subLines = subResult.fullDsl.split(/\r?\n/);
          for (let j = 0; j < subLines.length; j++) {
            resultLines.push(subLines[j]);
            lineMap.push(subResult.lineMap[j] || { file: resolvedPath, originalLine: j + 1 });
          }
        } catch (err: any) {
          if (err instanceof ParseError && !err.message.includes('Circular')) {
            throw err;
          }
          throw err;
        }
      }
    } else {
      resultLines.push(line);
      lineMap.push({ file: normalizedEntry, originalLine: originalLineNum });
    }
  }

  return {
    fullDsl: resultLines.join('\n'),
    lineMap,
  };
}

/**
 * Maps a parser error back to the originating file and line using lineMap.
 */
export function mapParseError(
  error: any,
  lineMap: SourceLineMapping[],
  defaultFile: string = 'workspace.dsl'
): { message: string; line: number; column: number; file: string } {
  if (!error) {
    return { message: 'Unknown error', line: 1, column: 1, file: defaultFile };
  }

  const errLine = typeof error.line === 'number' ? error.line : 1;
  const errCol = typeof error.column === 'number' ? error.column : 1;
  const mapped = lineMap[errLine - 1];

  return {
    message: error.message || 'Syntax error',
    line: mapped ? mapped.originalLine : errLine,
    column: errCol,
    file: mapped ? mapped.file : defaultFile,
  };
}
