const {Command, flags} = require('@oclif/command')
const {cli} = require('cli-ux')
const chalk = require('chalk')
const shell = require('shelljs')

class EasyAndroidEmulatorCommand extends Command {
  async run() {
    const {flags} = this.parse(EasyAndroidEmulatorCommand)
    const {args} = this.parse(EasyAndroidEmulatorCommand)
    var device = args.device
    let verbose = flags.verbose
    let persistAvd = flags.persist

    // STEPS:
    // 0. If no device name or model is given, prompt if Pixel 3 XL device should be used instead?
    // 1. Parse CSV to get specs for the model (will need to check based on both device name & model)
    // 2. Once match spec is found, Check if suitable emulator is already available,
    // 3. If so, directly start the emulator (skip steps 4, 5 & 7)
    //    (NOTE: Since the emulator already exists, it was persisted, do NOT delete it)
    // 4. If not, then download required SDKs using `sdkmanager` (if they're not already there).
    // 5. Once SDKs are ready, create the emulator using `avdmanager`.
    // 6. Start the emulator using `emulator`.
    // 7. Unless the user has choosen to persist the avd, delete the avd using `avdmanager`

    if (!device) {
      let shouldProceed = await cli.confirm('Device not specified, Create emulator with ' + chalk.green('Pixel 3 XL') + ' specs? (y/n)')
      if (!shouldProceed) {
        return
      }
      device = 'Pixel 3 XL'
    }

    shell.echo()

  }
}

async function downloadSystemImage(systemImage) {
  if (!shell.which('sdkmanager')) {
    shell.echo('Sorry, this scrip requires sdkmanager')
    shell.exit(1)
  }

  return execute(`sdkmanager --install "${systemImage}"`)
}

async function createEmulator(avdName, systemImage) {
  if (!shell.which('avdmanager')) {
    shell.echo('Sorry, this scrip requires avdmanager')
    shell.exit(1)
  }

  return execute(`echo no | avdmanager --verbose create avd --force --name "${avdName}" --package "${systemImage}"`)
}

async function deleteEmulator(avdName) {
  if (!shell.which('avdmanager')) {
    shell.echo('Sorry, this scrip requires avdmanager')
    shell.exit(1)
  }

  return execute(`avdmanager --verbose delete avd --name  "${avdName}"`)

async function startEmulator(avdName, resolution, verbose) {
  checkShellCommand('emulator')
  return execute(`emulator @${avdName} -skin ${resolution} &`, verbose)
}

function checkShellCommand(command) {
  if (!shell.which(`${command}`)) {
    shell.echo(`Sorry, this scrip requires ${command}`)
    shell.exit(1)
  }
}

/**
 * Execute shell commands.
 * @param {String} cmd Command to be executed
 * @param {Boolean} isVerbose Whether shell results should be verbose (printed on screen) or silent
 * @param {Boolean} isAsync Whether command should be executed asynchronously
 * @return {Object} { stdout: String, stderr: String }
 */
async function execute(cmd, isVerbose = false, isAsync = false) {
  return new Promise(function (resolve, reject) {
    shell.exec(cmd, {silent: !isVerbose, async: isAsync}, (err, stdout, stderr) => {
      if (err) {
        reject(err)
      } else {
        resolve({stdout, stderr})
      }
    })
  })
}

EasyAndroidEmulatorCommand.description = `Create and run android emulators with just device name/model.
Create and run android emulators in a quick & easy manner with just device name/model. Use the various flags to customize the emulator as per your requirements.
`

EasyAndroidEmulatorCommand.args = [
  {
    device: 'device',
    description: 'Device name or model',
    required: false
  }
]

EasyAndroidEmulatorCommand.flags = {
  // add --version flag to show CLI version
  version: flags.version(),
  // add --help flag to show CLI version
  help: flags.help({char: 'h'}),
  // add --verbose or -v flag to show verbose logs
  verbose: flags.boolean({
    char: 'v',
    description: 'show verbose logs',
    required: false,
    default: false,
  }),
  // add --persist or -p flag to persist avd
  persist: flags.boolean({
    char: 'p',
    description: 'persist the created avd (makes it faster for subsequent runs)',
    required: false,
    default: false,
  }),
}

module.exports = EasyAndroidEmulatorCommand
