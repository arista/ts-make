import * as ConfigLoader from "./ConfigLoader"
import * as Utils from "./utils/Utils"
import {loadConfig} from "./ConfigLoader"
import {configToModel} from "./ConfigToModel"

export async function make(props: {
  configFile?: string|null,
  target?: string|null,
}) {
  const {configFile, target} = props
  const basedir = Utils.getProjectRoot()
  const config = await ConfigLoader.loadConfig({ configFile })
  const model = configToModel({config, basedir})
  console.log(`hello!`)
}
