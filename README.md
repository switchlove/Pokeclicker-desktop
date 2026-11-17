# Pokeclicker Desktop

A web wrapper for Pokeclicker

[![total downloads](https://img.shields.io/github/downloads/RedSparr0w/Pokeclicker-Desktop/total?label=total%20downloads&style=flat-square) ![downloads](https://img.shields.io/github/downloads/RedSparr0w/Pokeclicker-Desktop/latest/total?style=flat-square)](https://github.com/RedSparr0w/Pokeclicker-desktop/releases/latest)

## Features:
- Runs in background when minimised
- Works offline (after first run, once initial download completed)
- Auto download updates
- Discord rich presence (customizable)

![](https://i.imgur.com/5QQfoiZ.png)

## Building the macOS DMG and Linux deb on a local Mac

`npm run dist:mac:remote` sends the working tree to a Mac over ssh, runs `npm run dist:mac` there and copies the DMG (plus `.blockmap` and the update `.yml`) back into `dist/`. `npm run dist:tux:remote` does the same for the Linux `.deb`, which can't be built on Windows. To run a different npm script, pass its name after `--`: `npm run dist:mac:remote -- <script>`.

The Mac is the ssh host `macbuild`. To use a different host, set `MAC_BUILD_HOST`. One-time setup:

- **Mac** (macOS 13.5+; Node 24 needs it): turn on Remote Login, install the Xcode command line tools, Homebrew (`brew install gettext xz`; `xz` is for the Linux deb) and [nvm](https://github.com/nvm-sh/nvm). The build runs `nvm install` itself, so the version in `.nvmrc` is installed on first use.
- **Lid closed with no display attached**: `sudo pmset -a disablesleep 1` (undo: `sudo pmset -a disablesleep 0`), and keep it on the charger. If FileVault is on, an Intel Mac won't accept ssh after a reboot until someone logs in at the Mac.
- **Windows**: set up key auth to the Mac, then add an alias to `%USERPROFILE%\.ssh\config`:
  ```
  Host macbuild
      HostName <mac-ip>
      User <mac-user>
      ServerAliveInterval 30
  ```

Builds run in `~/pokeclicker-desktop-build` on the Mac. `node_modules` is kept between builds, and `npm ci` only runs when `package-lock.json` or the Node version changes.
