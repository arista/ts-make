import "source-map-support/register.js"
import * as OC from "@oclif/core"
import {loadConfig} from "../../lib/ConfigLoader"
import * as Utils from "../../lib/utils/Utils"
import * as ModelBuilder from "../../lib/ModelBuilder"

export class Command extends OC.Command {
  static override description = "Make a build target"

  static override args = {}
  static override flags = {
    file: OC.Flags.string({
      char: "f",
      description: `The config file (default is "ts-make.[json, js, cjs, mjs, ts]" in package directory)`,
      required: false,
    }),
    check: OC.Flags.boolean({
      char: "c",
      description: `Perform some checks on the configuration file`,
      required: false,
      default: false,
    }),
  }
  static override enableJsonFlag = true

  async run() {
    const {args, flags} = await this.parse(Command)
    const { file, check } = flags
    try {
      return await (async () => {
        const config = await loadConfig({ configFile: file })
        const basedir = Utils.getProjectRoot()
        if (check) {
          const buildCtx = new ModelBuilder.ModelBuilderContext(baseDir)
          const model = ModelBuilder.buildModel(config, buildCtx)
        }
        this.log(JSON.stringify(config, null, 2))
        return config
      })()
    }
    catch (e) {
      this.log(`${e}`)
      return null
    }
  }
}
