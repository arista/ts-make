import {packageDirectorySync} from "pkg-dir"

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
