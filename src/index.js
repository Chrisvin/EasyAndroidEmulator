const {Command, flags} = require('@oclif/command')

class EasyAndroidEmulatorCommand extends Command {
  async run() {
    const {flags} = this.parse(EasyAndroidEmulatorCommand)
    const name = flags.name || 'Pixel 3 XL'

    // STEPS:
    // 1. Parse CSV to get specs for the model (will need to check based on both device name & model)
    // 2. Once match spec is found, Check if suitable emulator is already available,
    // 3. If so, directly start the emulator (skip steps 4, 5 & 7)
    //    (NOTE: Since the emulator already exists, it was persisted, do NOT delete it)
    // 4. If not, then download required SDKs using `sdkmanager` (if they're not already there).
    // 5. Once SDKs are ready, create the emulator using `avdmanager`.
    // 6. Start the emulator using `emulator`.
    // 7. Unless the user has choosen to persist the avd, delete the avd using `avdmanager`

    shell.echo(`Hello ${name}`)

    let avdName = 'generic_30'
    let systemImage = 'system-images;android-30;google_apis_playstore;x86'

    await downloadSystemImage(systemImage)
    await createEmulator(avdName, systemImage)
    await startEmulator(avdName)

    // await deleteEmulator(avdName)

    shell.echo(`Bye ${name}`)
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
}

async function startEmulator(avdName) {
  if (!shell.which('emulator')) {
    shell.echo('Sorry, this script requires emulator')
    shell.exit(1)
  }

  return execute(`emulator @${avdName} &`)
}

/**
 * Execute shell commands.
 * @param {String} cmd Command to be executed
 * @return {Object} { stdout: String, stderr: String }
 */
async function execute(cmd) {
  return new Promise(function (resolve, reject) {
    shell.exec(cmd, (err, stdout, stderr) => {
      if (err) {
        reject(err)
      } else {
        resolve({stdout, stderr})
      }
    })
  })
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