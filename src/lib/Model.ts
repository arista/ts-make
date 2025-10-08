import * as P from "./Plugin"

export class MakeSpec {
  plugins = new Array<Plugin>()
  targets = new Array<Target>()
  targetsByName = new Map<string, Target>()
  actions = new Array<Action>
  actionsByFullName = new Map<string, Action>()
}

export class Plugin {
  actions = new Array<Action>()
  plugin!: P.Plugin

  constructor(
    public name: string,
    public builtIn: boolean,
    public alias: string|null
  ) {}

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
    public action: P.Action
  ) {}
}

export class Target {
  deps!:Array<Target>

  constructor(
    public name: string,
    public action: Action|null,
    public args: any
  ) {}
}
