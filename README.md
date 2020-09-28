EasyAndroidEmulator
===================

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/EasyAndroidEmulator.svg)](https://npmjs.org/package/EasyAndroidEmulator)
[![Downloads/week](https://img.shields.io/npm/dw/EasyAndroidEmulator.svg)](https://npmjs.org/package/EasyAndroidEmulator)
[![License](https://img.shields.io/npm/l/EasyAndroidEmulator.svg)](https://github.com/Chrisvin/EasyAndroidEmulator/blob/master/package.json)

<p align="center"><img src="./screenrecording/EasyAndroidEmulator_Demo.gif"/></p>

Create and run android emulators in a quick & easy manner with just device name/model.
Use the various flags to customize the emulator as per your requirements.
### Install using npm
```sh-session
$ npm install -g EasyAndroidEmulator
```
Following which, the keyword `emulate` can be used to quickly emulate android devices.
### Pass in Device Name or Model as the argument
```sh-session
$ emulate "Pixel 4 XL"
```

## Flags
| Flag | Description |
| :-: | :-: |
| -h, --help | show CLI help |
| --version | show CLI version |
| -v, --verbose | show verbose logs |
| -n, --name | name of the AVD to be (created &) used |
| -p, --persist | persist the created avd (makes it faster for subsequent runs) |
| -f, --force | force recreation of the emulator avd |
| --android | set the android API level for the AVD (Use along with -f flag if AVD already exists) |
| --abi | set the preferred ABI for the AVD (Use along with -f flag if AVD already exists) |
| -r, --resolution | set the resolution of the AVD (Use along with -f flag if AVD already exists). Eg: -r 1080x2160 |
| -d, --density | set the density of the AVD (Use along with -f flag if AVD already exists). Eg: -d 440 |
