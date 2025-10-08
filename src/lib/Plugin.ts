export type Plugin = (host: PluginHost)=>Promise<void>

export interface PluginHost {
  registerAction(name: string, action: Action<any>): void
}

export interface Action<T> {
  run<T>(args: T):Promise<void>
}
