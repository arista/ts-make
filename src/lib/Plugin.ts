export type Plugin = (host: PluginHost)=>Promise<void>

export interface PluginHost {
  registerAction(name: string, action: Action): void
}

export interface Action {
}
