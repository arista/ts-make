import {pathToFileURL} from "url"
import * as z from "zod"
import * as esbuild from "esbuild"
import path from "node:path"
import * as fs from "node:fs"
import * as Utils from "./Utils"

// Utilities for reading and validating "export files" - files that export some JSON value (such as a configuration file).  These could be:
// * a JSON file
// * a JS file (.js, .cjs, .mjs) that is imported (executed) and has a default export
// * a TS file that is bundled into a .mjs file and handled above as a JS file

// Import and run a JS file, retrieve its default export, validate it against the given schema, then return it
export async function validateExportFromJsFile<S extends z.ZodTypeAny>(props: {
  filename: string
  schema: S
}): Promise<z.infer<S>> {
  const {filename, schema} = props
  const mod = await(async ()=>{
    try {
      return await import(pathToFileURL(filename).href)
    }
    catch(e) {
      throw new Error(`Error loading file "${filename}": ${e}`)
    }
  })()
  // Handle ESM "default" export or CJS "module.exports"
  const modExportP = mod.default ?? mod
  const modExport = Utils.isPromise(modExportP) ? await modExportP : modExportP
  const parsed = schema.safeParse(modExport)
  if (!parsed.success) {
    throw new Error(
      `Value from "${filename}" failed schema validation:\n${parsed.error.toString()}`
    );
  }
  return parsed.data as z.infer<S>
}

// Read the configuration from a typescript file by using esbuild to bundle the file, then import the file and return its default
export async function validateExportFromTSFile<S extends z.ZodTypeAny>(props: {
  filename: string
  schema: S
}): Promise<z.infer<S>> {
  const {filename, schema} = props
  const projectRoot = Utils.getProjectRoot()
  // Bundle to a temporary file under node_modules, so that when that file is imported, node is able to resolve any packages that the configuration file itself imported.
  const outdir = path.join(projectRoot, "node_modules", ".esbuild-tmp")
  const outname = `${path.basename(filename)}.mjs`
  const outfile = path.join(outdir, outname)

  try {
    await esbuild.build({
      entryPoints: [filename],
      outfile,
      bundle: true,
      format: "esm",
      platform: "node",
      packages: "external",
      sourcemap: false,
      external: [],
    })
  }
  catch (e) {
    throw new Error(`Error building file ${filename}: ${e}`)
  }    

  return validateExportFromJsFile({filename: outfile, schema})
}

export async function validateExportFromJSONFile<S extends z.ZodTypeAny>(props: {
  filename: string
  schema: S
}): Promise<z.infer<S>> {
  const {filename, schema} = props
  const fileText = fs.readFileSync(filename, {encoding: "utf-8"})
  const fileJson = JSON.parse(fileText)

  const parsed = schema.safeParse(fileJson)
  if (!parsed.success) {
    throw new Error(
      `Value from "${filename}" failed schema validation:\n${parsed.error.toString()}`
    );
  }
  return parsed.data as z.infer<S>
}

// Reads and validates the export from the given export file
export async function validateExportFromExportFile<S extends z.ZodTypeAny>(props: {
  file: ExportFile,
  schema: S,
}): Promise<z.infer<S>> {
  const {file, schema} = props
  switch(file.type) {
    case "JSExportFile":
      return validateExportFromJsFile({filename: file.filename, schema})
    case "JSONExportFile":
      return validateExportFromJSONFile({filename: file.filename, schema})
    case "TSExportFile":
      return validateExportFromTSFile({filename: file.filename, schema})
  }
}

export type ExportFile = JSExportFile | JSONExportFile | TSExportFile

export type JSExportFile = {
  type: "JSExportFile"
  filename: string
}

export type JSONExportFile = {
  type: "JSONExportFile"
  filename: string
}

export type TSExportFile = {
  type: "TSExportFile"
  filename: string
}

export const jsExtensions = [".js", ".mjs", ".cjs"]
export const tsExtensions = [".ts"]
export const jsonExtensions = [".json"]
export const exportFileExtensions = [
  ...jsExtensions,
  ...tsExtensions,
  ...jsonExtensions,
]

// Returns the type of export file based on the filename
export function filenameToExportFile(filename: string): ExportFile {
  for(const e of jsExtensions) {
    if (filename.endsWith(e)) {
      return {
        type: "JSExportFile",
        filename,
      }
    }
  }
  for(const e of tsExtensions) {
    if (filename.endsWith(e)) {
      return {
        type: "TSExportFile",
        filename,
      }
    }
  }
  for(const e of jsonExtensions) {
    if (filename.endsWith(e)) {
      return {
        type: "JSONExportFile",
        filename,
      }
    }
  }
  throw new Error(`${filename} does not end with a recognized extension (${JSON.stringify(exportFileExtensions)})`)
}

// Searches for a JS/TS/JSON file that start with the given basename
export async function findExportFile(props: {
  basename: string
}): Promise<ExportFile | null> {
  const {basename} = props
  for(const e of exportFileExtensions) {
    const filename = `${basename}${e}`
    if (Utils.isFile(filename)) {
      return filenameToExportFile(filename)
    }
  }
  return null
}
