import "source-map-support/register.js"
import * as OC from "@oclif/core"
import * as Make from "../../lib/Make"

export class Command extends OC.Command {
  static override description = "Make a build target"

  static override args = {
    target: OC.Args.string({
      description: `The target to build`,
      required: false,
    }),
  }
  static override flags = {
  }
  static override enableJsonFlag = true

  async run() {
    const {args, flags} = await this.parse(Command)
    const {target} = args
    return await (async () => {
      await Make.make({target})
    })()
  }
}
