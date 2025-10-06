import "source-map-support/register.js"
import * as OC from "@oclif/core"
import * as ConfigLoader from "../../lib/ConfigLoader"

export class Command extends OC.Command {
  static override description = "Make a build target"

  static override args = {}
  static override flags = {
    file: OC.Flags.string({
      char: "f",
      description: `The config file (default is "ts-make.[json, js, cjs, mjs, ts]" in package directory)`,
      required: false,
    }),
  }
  static override enableJsonFlag = true

  async run() {
    const {args, flags} = await this.parse(Command)
    const { file } = flags
    try {
      return await (async () => {
        const config = await ConfigLoader.loadConfig({ configFile: file })
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
