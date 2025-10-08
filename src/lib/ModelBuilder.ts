import * as C from "./Config"
import * as M from "./Model"
import * as GML from "./utils/GenericModuleLoader"
import * as P from "./Plugin"

export class ModelBuilderContext {
  pluginLoaderCache = new Map<string, Promise<P.Plugin>>()

  constructor(public baseDir:string) {}
}

export async function buildModel(config: C.Config, ctx: ModelBuilderContext): Promise<M.MakeSpec> {
  const makeSpec = new M.MakeSpec()
  const targetConfigsByTarget = new Map<M.Target, C.Target>()

  async function run() {
    addPlugins()
    await loadPlugins()
    await initializePlugins()
    addTargets()
    resolveTargets()
    checkTargetsForDepCycles()
  }

  function addPlugins() {
    // Add the specified plugins
    for(const pluginConfig of (config.plugins ?? [])) {
      addPlugin(pluginConfig, false)
    }

    // FIXME - how to add the built-in plugins
  }

  function addPlugin(c: C.Plugin, builtIn: boolean) {
    if (typeof c === "string") {
      makeSpec.plugins.push(new M.Plugin(c, builtIn, null))
    }
    else {
      makeSpec.plugins.push(new M.Plugin(c.name, builtIn, c.alias ?? null))
    }
  }
  
  async function loadPlugins() {
    // Load the plugins in parallel
    const plugins = makeSpec.plugins
    const pluginNames = plugins.map(b=>b.name)
    const baseDir = ctx.baseDir
    const toInstance = (mod: unknown, spec: string, url: string):P.Plugin => {
      if (typeof mod !== "function") {
        throw new Error(`Plugin "${spec}" must export a default function of type "(host: PluginHost)=>Promise<void>"`)
      }
      else {
        return mod as P.Plugin
      }
    }
    const opts:GML.LoadManyOptions<P.Plugin> = {
      cache: ctx.pluginLoaderCache
    }
    const pluginsByName = await GML.loadMany(
      pluginNames,
      baseDir,
      toInstance,
      opts
    )

    // Assign the loaded plugins back to the builders
    for(const pluginModel of plugins) {
      const {name} = pluginModel
      const plugin = pluginsByName.get(name)
      if (plugin == null) {
        throw new Error(`Assertion failed: plugin "${name}" was not loaded`)
      }
      else {
        pluginModel.plugin = plugin
      }
    }
  }

  async function initializePlugins() {
    await Promise.all(makeSpec.plugins.map(b=>initializePlugin(b)))
  }

  async function initializePlugin(plugin: M.Plugin) {
    const host = new ModelBuilderPluginHost(makeSpec, plugin)
    await plugin.plugin(host)
  }

  // Create the initial set of targets, to be filled in later
  function addTargets() {
    for(const targetConfig of (config.targets ?? [])) {
      addTarget(targetConfig)
    }
  }

  function addTarget(targetConfig: C.Target) {
    const {name} = targetConfig

    const action = (()=>{
      const actionFullName = targetConfig.action
      if (actionFullName == null) {
        return null
      }
      const action = makeSpec.actionsByFullName.get(actionFullName)
      if (action == null) {
        throw new Error(`Action "${actionFullName}" specified by target "${name}" not found`)
      }
      return action
    })()
    
    const target = new M.Target(name, action, targetConfig.args)
    if (makeSpec.targetsByName.has(name)) {
      throw new Error(`Target "${name}" is defined multiple times`)
    }
    makeSpec.targets.push(target)
    makeSpec.targetsByName.set(name, target)
    targetConfigsByTarget.set(target, targetConfig)
  }

  // Resolve any references between targets
  function resolveTargets() {
    for(const target of makeSpec.targets) {
      resolveTarget(target)
    }
  }

  function resolveTarget(target: M.Target) {
    const targetConfig = targetConfigsByTarget.get(target)
    if (targetConfig == null) {
      throw new Error(`Assertion failed: targetConfig is null`)
    }
    for(const dep of (targetConfig.deps ?? [])) {
      const depTarget = makeSpec.targetsByName.get(dep)
      if (depTarget == null) {
        throw new Error(`Target "${target.name}" references non-existent dep target "${dep}"`)
      }
      target.deps.push(depTarget)
    }
  }

  function checkTargetsForDepCycles() {
    for(const target of makeSpec.targets) {
      checkTargetForDepCycle(target)
    }
  }

  function checkTargetForDepCycle(target: M.Target, depsPath: Array<M.Target> = []) {
    const newDeps = [...depsPath, target]
    for(const dep of target.deps) {
      if (newDeps.indexOf(dep) >= 0) {
        const depsStr = [...newDeps, dep].map(d=>d.name).join(" -> ")
        throw new Error(`Deps cycle detected: ${depsStr}`)
      }
      checkTargetForDepCycle(dep, newDeps)
    }
  }

  await run()
  return makeSpec
}

class ModelBuilderPluginHost implements P.PluginHost {
  constructor(
    public makeSpec: M.MakeSpec,
    public plugin: M.Plugin
  ) {}
  
  registerAction(name: string, action: P.Action): void {
    const actionFullName = this.plugin.toFullName(name)
    const actionModel = new M.Action(name, actionFullName, action)
    const actionsByFullName = this.makeSpec.actionsByFullName
    if (actionsByFullName.has(actionFullName)) {
      throw new Error(`Action "${actionFullName}" has already been registered`)
    }
    this.makeSpec.actions.push(actionModel)
    actionsByFullName.set(actionFullName, actionModel)
  }
}
