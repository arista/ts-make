import path from "node:path"
import * as C from "./Config"
import * as Utils from "./Utils"
import * as ExportFiles from "./ExportFiles"

export async function loadConfig(props: {
  configFile?: string|null
  curdir?: string|null
}): Promise<C.Config> {
  const {configFile, curdir} = props
  const exportFile = await findConfig({configFile, curdir})
  return ExportFiles.validateExportFromExportFile({
    file: exportFile,
    schema: C.ConfigSchema,
    curdir,
  })
}

export async function findConfig(props: {
  configFile?: string|null
  curdir?: string|null
}): Promise<ExportFiles.ExportFile> {
  const {configFile, curdir} = props
  if (configFile != null) {
    return ExportFiles.filenameToExportFile(configFile)
  }
  else {
    const basename = path.join(Utils.getProjectRoot(curdir), "ts-make")
    const exportFile = await ExportFiles.findExportFile({basename})
    if (exportFile == null) {
      throw new Error(`No ts-make file found at "${basename}${JSON.stringify(ExportFiles.exportFileExtensions)}"`)
    }
    else {
      return exportFile
    }
  }
}
