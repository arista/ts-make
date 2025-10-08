import * as P from "./Plugin"

export class MakeSpec {
  plugins = new Array<Plugin>()
  targets = new Array<Target>()
  targetsByName = new Map<string, Target>()
  actions = new Array<Action>
  actionsByFullName = new Map<string, Action>()

  getTargetOrDefault(name: string|null): Target {
    if (name == null) {
      const ret = this.targetsByName.get("default")
      if (ret == null) {
        throw new Error(`No target specified, and no "default" target defined`)
      }
      return ret
    }
    else {
      const ret = this.targetsByName.get(name)
      if (ret == null) {
        throw new Error(`Target "${name}" not defined`)
      }
      return ret
    }
  }
}

export class Plugin {
  actions = new Array<Action>()
  plugin!: P.Plugin

  constructor(
    public name: string,
    public builtIn: boolean,
    public alias: string|null,
    plugin: P.Plugin|null
  ) {
    if (plugin != null) {
      this.plugin = plugin
    }
  }

  // Qualifies a name exported by the plugin (action names, for example).  Built-in plugins don't add a prefix, while non-built-in plugins prefix with "{plugin alias or name}:"
  toFullName(name: string): string {
    if (this.builtIn) {
      return name
    }
    else {
      const baseName = this.alias ?? this.name
      return `${baseName}:${name}`
    }
  }
}

export class Action {
  constructor(
    public name: string,
    public fullName: string,
    public action: P.Action<any>
  ) {}
}

export class Target {
  deps = new Array<Target>()

  constructor(
    public name: string,
    public action: Action|null,
    public args: any
  ) {}
}
