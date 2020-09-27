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

    cli.action.start('Getting device specs for ' + chalk.greenBright.underline.bold(`${device}`))
    await cli.wait(1000) // Reading the CSV & determining the specs
    cli.action.stop(chalk.green('Specs determined\n'))

    let deviceName = 'Pixel 3 XL'
    let deviceModel = 'crosshatch'
    let androidVersion = 30
    let preferredAbi = 'x86'
    let resolution = '1080x1920' // '1440x2960'
    let avdName = flags.name || `${deviceName.replace(/ /g, '_')}_API_${androidVersion}`
    let density = 560

    shell.echo('Specs for ' + chalk.greenBright.bold(`${deviceName} (${deviceModel}) `) + '-')
    shell.echo('Android Version: ' + chalk.greenBright.bold(`${androidVersion}`))
    shell.echo('Preferred ABI: ' + chalk.greenBright.bold(`${preferredAbi}`))
    shell.echo('Screen Resolution: ' + chalk.greenBright.bold(`${resolution}`))
    shell.echo('Screen Density: ' + chalk.greenBright.bold(`${density}\n`))

    shell.echo('AVD Name: ' + chalk.greenBright.bold(`${avdName}\n`))

    let isAvdAvailable = await checkForAvd(avdName)
    if (isAvdAvailable === true) {
      shell.echo('AVD available\n')
    } else {
      shell.echo('AVD unavailable, creating new AVD\n')

      cli.action.start('Determining most suitable system image')
      let systemImage = await findSystemImage(androidVersion, preferredAbi, verbose)
      cli.action.stop(chalk.green('Determined\n'))
      this.log(chalk.greenBright.bold(`${systemImage}`))
      shell.echo()

      cli.action.start('Setting up system image for AVD')
      await downloadSystemImage(systemImage, verbose)
      cli.action.stop(chalk.green('Finished'))
      shell.echo()

      cli.action.start('Creating AVD for emulator')
      await createEmulator(avdName, systemImage, verbose)
      cli.action.stop(chalk.green('AVD created'))
      shell.echo()
    }

    cli.action.start('Running the emulator')
    await startEmulator(avdName, resolution, verbose)
    cli.action.stop(chalk.green('Emulator closed'))
    shell.echo()

    if (isAvdAvailable !== true && persistAvd !== true) {
      cli.action.start(chalk.red('Deleting the emulator'))
      await deleteEmulator(avdName, verbose)
      cli.action.stop(chalk.red('Done'))
      shell.echo()
    }
  }
}

/**
* Finds the most suitable system image given the android version & preferred ABI.
* @param {String} androidVersion Android version for the AVD
* @param {String} preferredAbi Preferred ABI for the AVD
* @param {Boolean} verbose Whether shell results should be verbose (printed on screen) or silent
*/
async function findSystemImage(androidVersion, preferredAbi, verbose) {
  checkShellCommand('sdkmanager')

  var systemImage = ''
  if (shell.which('find')) {
    // Probably a windows system
    let {stdout} = await execute(`sdkmanager --list --verbose | find "${androidVersion}"`, verbose)
    let imagesWithPreferedAbi = stdout.toString().split('\n')
    imagesWithPreferedAbi.forEach(function (line) {
      if (line.includes('system-images')) {
        if (line.includes(`${preferredAbi}`)) {
          systemImage = line
        } else if (systemImage === '') {
          //
        }
      }
    })
  } else if (shell.which('grep')) {
    // Probably unix based system
  } else {
    // Have to go the hard route of parsing output line by line.
    // systemImage = `system-images;android-${androidVersion};${api};${preferredAbi}`
  }
  return systemImage
}

/**
* Downloads the system image through `sdkmanager`.
* @param {String} systemImage Image of the system for the AVD
* @param {Boolean} verbose Whether shell results should be verbose (printed on screen) or silent
*/
async function downloadSystemImage(systemImage, verbose) {
  checkShellCommand('sdkmanager')
  return execute(`sdkmanager --install "${systemImage}"`, verbose)
}

/**
* Creates Emulator AVD with the given name & system image.
* @param {String} avdName Name of the AVD
* @param {String} systemImage Image of the system for the AVD
* @param {Boolean} verbose Whether shell results should be verbose (printed on screen) or silent
*/
async function createEmulator(avdName, systemImage, verbose) {
  checkShellCommand('avdmanager')

  let words = systemImage.split(';')
  let abi = words.pop()
  let tag = words.pop()
  return execute(`echo no | avdmanager --verbose create avd --force --name "${avdName}" --package "${systemImage}" --tag "${tag}" --abi "${abi}"`, verbose)
}

/**
* Deletes the AVD with the given name
* @param {String} avdName Name of the AVD
* @param {Boolean} verbose Whether shell results should be verbose (printed on screen) or silent
*/
async function deleteEmulator(avdName, verbose) {
  checkShellCommand('avdmanager')
  return execute(`avdmanager --verbose delete avd --name  "${avdName}"`, verbose)
}

/**
* Checks if AVD with given name is already available
* @param {String} avdName Name of the AVD
*/
async function checkForAvd(avdName) {
  checkShellCommand('avdmanager')

  let {stdout} = await execute('emulator -list-avds')
  let avds = stdout.toString().split('\r\n')
  var result = false
  avds.forEach(function (line) {
    if (line === avdName) {
      result = true
    }
  })
  return result
}

/**
* Starts the emulator with the given AVD name & resolution.
* @param {String} avdName Name of the AVD
* @param {String} resolution Resolution of the emulator
* @param {Boolean} verbose Whether shell results should be verbose (printed on screen) or silent
*/
async function startEmulator(avdName, resolution, verbose) {
  checkShellCommand('emulator')
  return execute(`emulator @${avdName} -skin ${resolution} &`, verbose)
}

/**
* Checks if the given command is available & can be called via shellJS.
* @param {String} command command to check for availability
*/
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
        if (!isVerbose) {
          shell.echo(
            chalk.red('-----\n') +
            chalk.redBright('Error occured, run in verbose mode to get more details.\n') +
            chalk.red('-----\n')
          )
        }
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
    name: 'device',
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
  // add --name or -n flag to name the AVD
  name: flags.string({
    char: 'n',
    description: 'name of the AVD to be (created &) used',
    required: false,
  }),
}

module.exports = EasyAndroidEmulatorCommand
