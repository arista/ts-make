import {packageDirectorySync} from "pkg-dir"
import path from "node:path"
import fs from "node:fs"

export function isFile(file: string): boolean {
  try {
    const stat = fs.statSync(file)
    return stat.isFile()
  }
  catch {
    return false
  }  
}

// Return the root of the project, from the specified directory, or
// the current working directory if not specified
export function getProjectRoot(curdir?: string | null | undefined): string {
  const dir = curdir ?? process.cwd()
  const ret = packageDirectorySync({cwd: dir})
  if (ret == null) {
    throw new Error(
      `Current directory is not under a project (no package.json found in ancestors)`
    )
  } else {
    return ret
  }
}

// Return true if the given value is a Promise
export function isPromise(obj: any): boolean {
  return obj && typeof obj === "object" && "then" in obj
}

export function resolvePath(basedir: string, pathname: string): string {
  if (path.isAbsolute(pathname)) {
    return pathname;
  }
  return path.resolve(basedir, pathname);
}
