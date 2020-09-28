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
    let forceAvd = flags.force

    // STEPS:
    // 0. If no device name or model is given, prompt if Pixel 3 XL device should be used instead?
    // 1. Parse CSV to get specs for the model (will need to check based on both device name & model)
    // 2. Once spec is found, Check if suitable emulator is already available,
    // 3. If so, directly start the emulator (i.e. skip steps 4, 5 & 7)
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
    let deviceDetail = await findDeviceDetails(device)
    let deviceDetails = deviceDetail.split(',')
    if (deviceDetails.length < 9) {
      cli.action.stop(chalk.red('Failed\n'))
      shell.echo(chalk.red('Failed to determine suitable specs for ') + chalk.greenBright.underline.bold(`${device}`))
      shell.echo(chalk.redBright('Try again with different device.'))
      return
    }
    cli.action.stop(chalk.green('Specs determined\n'))

    let deviceManufacturer = deviceDetails[0]
    let deviceName = deviceDetails[1]
    let deviceModel = deviceDetails[2]
    let rams = deviceDetails[3].split('-')
    let ram = rams[rams.length - 1]
    let resolution = deviceDetails[6]
    let density = deviceDetails[7]
    let preferredAbi = deviceDetails[8].split(';').pop() || 'x86'
    let androidVersion = deviceDetails[9].split(';').pop()

    let avdName = flags.name || `${deviceName.replace(/ /g, '_')}_API_${androidVersion}`

    shell.echo('Specs for ' + chalk.greenBright.bold(`${deviceName} (${deviceModel}) `) + '-')
    shell.echo('Android Version: ' + chalk.greenBright.bold(`${androidVersion}`))
    shell.echo('Preferred ABI: ' + chalk.greenBright.bold(`${preferredAbi}`))
    shell.echo('Screen Resolution: ' + chalk.greenBright.bold(`${resolution}`))
    shell.echo('Screen Density: ' + chalk.greenBright.bold(`${density}\n`))

    shell.echo('AVD Name: ' + chalk.greenBright.bold(`${avdName}\n`))

    var isAvdAvailable = await checkForEmulator(avdName)
    if (isAvdAvailable === true && forceAvd) {
      cli.action.start(chalk.red('Deleting existing AVD'))
      await deleteEmulator(avdName, verbose)
      cli.action.stop(chalk.red('Done'))
      shell.echo()
      isAvdAvailable = false
    }

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

      cli.action.start('Configuring the AVD setup')
      await configureEmulator(avdName, resolution, density)
      cli.action.stop(chalk.green('Done'))
      shell.echo()
    }

    cli.action.start('Running the emulator')
    await startEmulator(avdName, verbose)
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
* Find the details of the device
* @param {String} device Device name or model
*/
async function findDeviceDetails(device) {
  // Without comma after ${device} , it might result in partial match.
  // Example: Searching for "Pixel 4" might result in "Pixel 4 XL"
  return shell.grep('-i', `${device},`, `${__dirname}\\..\\data\\devices.csv`)
}

/**
* Finds the most suitable system image given the android version & preferred ABI.
* @param {String} androidVersion Android version for the AVD
* @param {String} preferredAbi Preferred ABI for the AVD
* @param {Boolean} verbose Whether shell results should be verbose (printed on screen) or silent
*/
async function findSystemImage(androidVersion, preferredAbi, verbose) {
  checkShellCommand('sdkmanager')

  var images = ['']
  if (shell.which('find')) {
    // Probably a windows system
    let {stdout} = await execute(`sdkmanager --list --verbose | find "${androidVersion}"`, verbose)
    images = stdout.toString().split('\n')
  } else if (shell.which('grep')) {
    // Probably unix based system
    let {stdout} = await execute(`sdkmanager --list --verbose | grep "${androidVersion}"`, verbose)
    images = stdout.toString().split('\n')
  } else {
    // Filter out suitable system images using android version as filter
    let {stdout} = await execute('sdkmanager --list --verbose', verbose)
    images = stdout.toString().split('\n').filter(function (str) {
      return str.includes(androidVersion)
    })
  }
  return  getSuitableSystemImage(images, preferredAbi)
}

/**
* @param {Array} images Array of system image strings
* @param {String} preferredAbi The preferred ABI for the system image
* @return {String} The most suitable system image, from the given array of images.
*/
function getSuitableSystemImage(images, preferredAbi) {
  var resultImage = ''
  images.forEach(function (line) {
    if (line.includes('system-images;')) {
      if (line.includes(`${preferredAbi}`)) {
        if (!resultImage.includes(`${preferredAbi}`) || line.includes('default') || line.includes('google_apis') || line.includes('google_apis_playstore')) {
          resultImage = line
        }
      } else if (resultImage === '') {
        if (line.includes('default') || line.includes('google_apis') || line.includes('google_apis_playstore')) {
          resultImage = line
        }
      }
    }
  })
  return resultImage
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
* Configure the emulator avd by modifying the content in config.ini file
* @param {String} avdName Name of the AVD
* @param {String} resolution Resolution of the emulator
* @param {String} density Screen density of the emulator
*/
async function configureEmulator(avdName, resolution, density) {
  var userName = ''
  if (shell.which('id')) {
    let {stdout} = await execute('id -un')
    userName = stdout.toString().trim()
  } else if (shell.which('whoami')) {
    let {stdout} = await execute('whoami')
    userName = stdout.toString().split('\\').pop().trim()
  } else {
    let {stdout} = await execute('echo %USERNAME%')
    userName = stdout.toString().trim()
  }

  var configLocation = ''
  if (shell.which('grep')) {
    configLocation = `~\\.android\\avd\\${avdName}.avd\\config.ini`
  } else {
    configLocation = `C:\\Users\\${userName}\\.android\\avd\\${avdName}.avd\\config.ini`
  }
  return execute(`echo skin.name=${resolution} >> ${configLocation} | echo hw.lcd.density=${density} >> ${configLocation} | echo hw.mainKeys=yes >> ${configLocation} | echo hw.keyboard=yes >> ${configLocation}`)
}

/**
* Checks if AVD with given name is already available
* @param {String} avdName Name of the AVD
*/
async function checkForEmulator(avdName) {
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
* @param {Boolean} verbose Whether shell results should be verbose (printed on screen) or silent
*/
async function startEmulator(avdName, verbose) {
  checkShellCommand('emulator')
  return execute(`emulator @${avdName} &`, verbose)
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
  // add --force or -f flag to force recreation of the AVD (if it's already available)
  force: flags.boolean({
    char: 'f',
    description: 'force recreation of the emulator avd',
    required: false,
    default: false,
  }),
  // add -android flag to set the android API level for the AVD (Use along with -f flag if AVD already exists)
  android: flags.integer({
    description: 'set the android API level for the AVD (Use along with -f flag if AVD already exists)',
    required: false,
  }),
  // add -abi flag to set the preferred ABI for the AVD (Use along with -f flag if AVD already exists)
  abi: flags.string({
    description: 'set the preferred ABI for the AVD (Use along with -f flag if AVD already exists)',
    required: false,
  }),
  // add --resolution or -r to set the resolution of the AVD (Use along with -f flag if AVD already exists)
  resolution: flags.string({
    char: 'r',
    description: 'set the resolution of the AVD (Use along with -f flag if AVD already exists). Eg: -r 1080x2160',
    required: false,
  }),
  // add --density or -d to set the density of the AVD (Use along with -f flag if AVD already exists)
  density: flags.integer({
    char: 'd',
    description: 'set the density of the AVD (Use along with -f flag if AVD already exists). Eg: -d 440',
    required: false,
  }),
}

module.exports = EasyAndroidEmulatorCommand
