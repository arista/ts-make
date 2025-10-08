import {z} from "zod"
import * as P from "../Plugin"

export interface BuiltInPluginHost {
  registerBuiltInPlugin(name: string, plugin: P.Plugin):void
}

export function registerBuiltInPlugins(host: BuiltInPluginHost) {
  host.registerBuiltInPlugin("@ts-make", tsmakePlugin)
}

export async function tsmakePlugin(host: P.PluginHost): Promise<void> {
  host.registerAction("print", new PrintAction())
}

//----------------------------------------
// PrintAction

export const PrintActionArgsSchema = z.union([z.string(), z.array(z.string())])
export type PrintActionArgs = z.infer<typeof PrintActionArgsSchema>

export class PrintAction implements P.Action<PrintActionArgs> {
  async run(args: PrintActionArgs, ctx: P.ActionContext):Promise<void> {
    if (typeof args === "string") {
      ctx.log(args)
    }
    else {
      for(const arg of args) {
        ctx.log(arg)
      }
    }
  }
}
