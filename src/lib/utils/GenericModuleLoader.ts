// Generic method for loading modules from module specifiers (i.e., module names).  Used, for example, to load plugins.  The main method to call is loadMany.
//
// Thanks ChatGPT

import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import * as path from "node:path";
import * as fs from "node:fs/promises";

export interface ResolveOptions {
  /** Extra subpaths to try on packages if the root entry isn't right. */
  subpathCandidates?: string[]; // e.g. ["/plugin", "/ts-make", "/dist/plugin"]
  /**
   * If we need to peek package.json "exports", choose keys that match this.
   * Example: /plugin|ts-make|loader/i
   */
  exportKeyPattern?: RegExp;
}

export interface LoadManyOptions<T> extends ResolveOptions {
  /**
   * If true, keep loading other specs and return successes.
   * Failures will be thrown as an AggregateError at the end, unless you pass
   * continueOnError=true AND swallowErrors=true.
   */
  continueOnError?: boolean;
  /** If true and continueOnError, do not throw; return only successes. */
  swallowErrors?: boolean;
  /** Provide an external cache if you want shared state across callers. */
  cache?: Map<string, Promise<T>>;
}

type AnyModule = Record<string, unknown> & {
  default?: unknown;
};

/** Per-process default cache (keyed by `${baseDir}::${spec}`) */
const defaultCache = new Map<string, Promise<unknown>>();

/**
 * Resolve a module specifier relative to a base directory, returning a file URL.
 */
export async function resolveFrom(
  spec: string,
  baseDir: string,
  opts: ResolveOptions = {}
): Promise<string> {
  const { subpathCandidates = ["/plugin", "/dist/plugin", "/ts-make", "/dist/ts-make"], exportKeyPattern = /plugin|ts-make|loader/i } = opts;

  // file: URLs pass straight through
  if (spec.startsWith("file:")) return spec;

  // relative/absolute paths
  if (spec.startsWith(".") || path.isAbsolute(spec)) {
    return pathToFileURL(path.resolve(baseDir, spec)).href;
  }

  // package name -> resolve from the project's node_modules
  const req = createRequire(path.join(baseDir, "__generic_loader__.cjs"));

  // 1) direct resolve of the package entry
  try {
    const entry = req.resolve(spec);
    return pathToFileURL(entry).href;
  } catch {
    // fall through
  }

  // 2) try common subpath candidates
  for (const sub of subpathCandidates) {
    try {
      const entry = req.resolve(spec + sub);
      return pathToFileURL(entry).href;
    } catch {
      /* keep trying */
    }
  }

  // 3) inspect package.json exports for helpful keys
  try {
    const pkgJsonPath = req.resolve(path.join(spec, "package.json"));
    const pkg = JSON.parse(await fs.readFile(pkgJsonPath, "utf8"));
    const exportsField = pkg?.exports;
    if (exportsField && typeof exportsField === "object") {
      const keys = Object.keys(exportsField);
      // Prefer explicit subpath keys (e.g. "./plugin")
      const candidates = keys
        .filter((k) => exportKeyPattern.test(k))
        // Put shorter/more direct keys first
        .sort((a, b) => a.length - b.length);

      for (const k of candidates) {
        try {
          const entry = req.resolve(path.join(spec, k));
          return pathToFileURL(entry).href;
        } catch {
          /* try next */
        }
      }
    }
  } catch {
    /* ignore */
  }

  throw new Error(
    `Cannot resolve "${spec}" from ${baseDir}. ` +
      `Check it's installed and exports a loadable entry (try adding one of: ${subpathCandidates.join(
        ", "
      )}).`
  );
}

/**
 * Load a single module as type T, using a user-supplied normalizer/validator.
 *
 * @param spec The import specifier (package name, local path, or file URL).
 * @param baseDir Project directory used for resolution.
 * @param toInstance Convert the raw module namespace to your desired T (can assert/throw).
 * @param opts Optional resolve and caching options.
 */
export async function loadOne<T>(
  spec: string,
  baseDir: string,
  toInstance: (mod: unknown, spec: string, url: string) => T,
  opts: LoadManyOptions<T> = {}
): Promise<T> {
  const cache = (opts.cache as Map<string, Promise<T>>) ?? (defaultCache as Map<string, Promise<T>>);
  const key = `${baseDir}::${spec}`;

  if (!cache.has(key)) {
    cache.set(
      key,
      (async () => {
        const url = await resolveFrom(spec, baseDir, opts);
        const mod = (await import(url)) as AnyModule;
        return toInstance(mod, spec, url);
      })()
    );
  }

  return cache.get(key)!;
}

/**
 * Load many modules concurrently. Returns a Map from spec -> instance.
 * See LoadManyOptions for error handling knobs.
 */
export async function loadMany<T>(
  specs: string[],
  baseDir: string,
  toInstance: (mod: unknown, spec: string, url: string) => T,
  opts: LoadManyOptions<T> = {}
): Promise<Map<string, T>> {
  const errors: Error[] = [];
  const pairs = await Promise.all(
    specs.map(async (spec) => {
      try {
        const instance = await loadOne(spec, baseDir, toInstance, opts);
        return [spec, instance] as const;
      } catch (err) {
        if (opts.continueOnError) {
          errors.push(wrapErr(err, spec));
          return null;
        }
        throw wrapErr(err, spec);
      }
    })
  );

  if (errors.length && !opts.swallowErrors) {
    throw new AggregateError(errors, `Failed to load ${errors.length} module(s).`);
  }

  const map = new Map<string, T>();
  for (const p of pairs) {
    if (p) map.set(p[0], p[1]);
  }
  return map;
}

function wrapErr(err: unknown, spec: string): Error {
  const e = err instanceof Error ? err : new Error(String(err));
  e.message = `[${spec}] ${e.message}`;
  return e;
}

/* ------------------------------------------------------------------ *
 * Helpers: build a normalizer for “plugin-like” modules.
 * Many ecosystems export one of:
 *   - default: T
 *   - { plugin: T }
 *   - { createPlugin(): T }
 * You can use this factory with a type-guard to produce toInstance().
 * ------------------------------------------------------------------ */

export interface PluginExportHints {
  /** names to probe as factory functions returning T */
  factoryExportNames?: string[]; // e.g. ["createPlugin", "from"]
  /** property names that might contain the instance directly */
  instanceExportNames?: string[]; // e.g. ["plugin", "instance"]
  /** whether to accept the entire module object as T if it passes validate */
  allowModuleNamespaceAsInstance?: boolean;
}

/**
 * Build a normalizer for typical plugin module shapes.
 * @param validate A type guard that confirms the shape of T.
 * @param hints Optional export probing hints.
 */
export function makePluginNormalizer<T>(
  validate: (x: unknown) => x is T,
  hints: PluginExportHints = {}
): (mod: unknown, spec: string, url: string) => T {
  const {
    factoryExportNames = ["createPlugin"],
    instanceExportNames = ["plugin"],
    allowModuleNamespaceAsInstance = false,
  } = hints;

  return (raw, spec, url) => {
    const mod = raw as AnyModule;

    // 1) default export
    if (validate(mod.default)) return mod.default as T;

    // 2) instance properties (e.g., { plugin: ... })
    for (const k of instanceExportNames) {
      if (validate((mod as any)[k])) return (mod as any)[k] as T;
    }

    // 3) factory functions (e.g., { createPlugin(): T })
    for (const k of factoryExportNames) {
      const maybe = (mod as any)[k];
      if (typeof maybe === "function") {
        const produced = maybe();
        if (validate(produced)) return produced;
      }
    }

    // 4) whole module (optional)
    if (allowModuleNamespaceAsInstance && validate(mod)) return mod as unknown as T;

    throw new Error(
      `Module "${spec}" (${url}) did not expose a valid instance ` +
        `(checked default, ${instanceExportNames.join(
          ", "
        )}, ${factoryExportNames.join(", ")}).`
    );
  };
}
