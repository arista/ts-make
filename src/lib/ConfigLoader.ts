import path from "node:path"
import * as C from "./Config"
import * as Utils from "./utils/Utils"
import * as ExportFiles from "./utils/ExportFiles"

export async function loadConfig(props: {
  configFile?: string|null
}): Promise<C.Config> {
  const {configFile} = props
  const exportFile = await findConfig({configFile})
  return ExportFiles.validateExportFromExportFile({
    file: exportFile,
    schema: C.ConfigSchema,
  })
}

export async function findConfig(props: {
  configFile?: string|null
}): Promise<ExportFiles.ExportFile> {
  const {configFile} = props
  if (configFile != null) {
    return ExportFiles.filenameToExportFile(configFile)
  }
  else {
    const basename = path.join(Utils.getProjectRoot(), "ts-make")
    const exportFile = await ExportFiles.findExportFile({basename})
    if (exportFile == null) {
      throw new Error(`No ts-make file found at "${basename}[${ExportFiles.exportFileExtensions.join(", ")}]"`)
    }
    else {
      return exportFile
    }
  }
}
