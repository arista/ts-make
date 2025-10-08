import {z} from "zod"

export type Plugin = (host: PluginHost)=>Promise<void>

export function definePlugin(f: Plugin):Plugin {
  return f
}
  
export interface PluginHost {
  registerAction(name: string, action: Action<any>): void
}

export interface Action<T> {
  argsSchema?: z.ZodTypeAny | null
  run(args: T, ctx: ActionContext):Promise<void>
}

export interface ActionContext {
  log(str:string):void

  // true if running in watch mode
  watch:boolean
}
