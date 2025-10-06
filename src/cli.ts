import {Command as SampleCommand} from "./cli/commands/sample"
import {Command as MakeCommand} from "./cli/commands/make"
import {Command as ShowConfigCommand} from "./cli/commands/show-config"

export const COMMANDS = {
  sample: SampleCommand,
  make: MakeCommand,
  "show-config": ShowConfigCommand,
}
