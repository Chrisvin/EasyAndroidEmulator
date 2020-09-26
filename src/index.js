const {Command, flags} = require('@oclif/command')

class EasyAndroidEmulatorCommand extends Command {
  async run() {
    const {flags} = this.parse(EasyAndroidEmulatorCommand)
    const name = flags.name || 'world'
    this.log(`hello ${name} from .\\src\\index.js`)
  }
}

EasyAndroidEmulatorCommand.description = `Create and run android emulators in a quick &amp; easy manner with just device name/model.
...
Extra documentation goes here
`

EasyAndroidEmulatorCommand.flags = {
  // add --version flag to show CLI version
  version: flags.version({char: 'v'}),
  // add --help flag to show CLI version
  help: flags.help({char: 'h'}),
  name: flags.string({char: 'n', description: 'name to print'}),
}

module.exports = EasyAndroidEmulatorCommand
