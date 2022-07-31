'use strict';

/* eslint-disable no-console */

const { autoUpdater } = require('electron-updater');
const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const url = require('url');
const DiscordRPC = require('discord-rpc');
const https = require('https');
const fs = require('fs');
const Zip = require('adm-zip');
const electron = require('electron');

const dataDir =  (electron.app || electron.remote.app).getPath('userData');

console.info('Data directory:', dataDir);

let checkForUpdatesInterval;
let newVersion = '0.0.0';
let newVersionA6 = '0.0.0';
let newFilesA6 = [];
let newDownloaded;
let currentVersion = '0.0.0';
let currentVersionA6 = '0.0.0';
let windowClosed = false;

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        titleBarStyle: 'default',
        icon: __dirname + '/icon.png',
        minWidth: 300,
        minHeight: 200,
        webPreferences: {
            webSecurity: false,
            backgroundThrottling: false,
        },
    });

    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.executeJavaScript(
            fs.readFileSync(`${__dirname}/discord.js`).toString()
        ).catch(e=>{});
    });

    mainWindow.setMenuBarVisibility(false);
    mainWindow.setTitle('PokéClicker ACSRQ Beta');

    // Check if we've already downloaded the data, otherwise load our loading screen
    if (fs.existsSync(`${dataDir}/pokeclicker-acsrq-beta/docs/index.html`)) {
        mainWindow.loadURL(`file://${dataDir}/pokeclicker-acsrq-beta/docs/index.html`);
    } else {
        mainWindow.loadURL(`file://${__dirname}/pokeclicker-acsrq-beta/docs/index.html`);
    }

    mainWindow.on('close', (event) => {
        windowClosed = true
    })
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    mainWindow.on('page-title-updated', function(e) {
        e.preventDefault()
    });
}

function createSecondaryWindow() {
    let newWindow = new BrowserWindow({
        titleBarStyle: 'default',
        icon: __dirname + '/icon.png',
        minWidth: 300,
        minHeight: 200,
        webPreferences: {
            webSecurity: false,
            backgroundThrottling: false,
        },
    });

    newWindow.setMenuBarVisibility(false);
    newWindow.setTitle('PokéClicker ACSRQ Beta (alternate)');

    // Check if we've already downloaded the data, otherwise load our loading screen
    if (fs.existsSync(`${dataDir}/pokeclicker-acsrq-beta/docs/index.html`)) {
        newWindow.loadURL(`file://${dataDir}/pokeclicker-acsrq-beta/docs/index.html`);
    } else {
        newWindow.loadURL(`file://${__dirname}/pokeclicker-acsrq-beta/docs/index.html`);
    }

    newWindow.on('close', (event) => {
        newWindow = true
    })
    newWindow.on('closed', () => {
        newWindow = null;
    });
    newWindow.on('page-title-updated', function(e) {
        e.preventDefault()
    });
    return newWindow;
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

/*
DISCORD STUFF
*/

const isMainInstance = app.requestSingleInstanceLock()

if (!isMainInstance) {
    app.quit()
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
        }
        createSecondaryWindow();
    })

    // Set this to your Client ID.
    const clientId = '733927271726841887';

    // Only needed if you want to use spectate, join, or ask to join
    DiscordRPC.register(clientId);

    const rpc = new DiscordRPC.Client({ transport: 'ipc' });
    const startTimestamp = new Date();

    async function setActivity() {
        if (!rpc || !mainWindow) {
            return;
        }

        let line1 = '';
        let line2 = '';

        try {
            [line1, line2] = await mainWindow.webContents.executeJavaScript('getDiscordRP()');
        } catch (e) {
            console.warn('Something went wrong, could not gather discord RP data');
        }

        // You'll need to have image assets uploaded to
        // https://discord.com/developers/applications/<application_id>/rich-presence/assets
        rpc.setActivity({
            details: line1.length <= 1 ? '--' : line1.substr(0, 128),
            state: line2.length <= 1 ? '--' : line2.substr(0, 128),
            // largeImageKey: 'image_name',
            // largeImageText: 'text when hovered',
            // smallImageKey: 'image_name',
            // smallImageText: 'text when hovered',
            instance: false,
        });
    }

    rpc.on('ready', () => {
        setActivity();

        // activity can only be set every 15 seconds
        setInterval(() => {
            setActivity();
        }, 15e3);
    });

    rpc.login({ clientId }).catch(console.error);

    /*
    UPDATE STUFF
    */
    const isNewerVersion = (version) => {
        return version.localeCompare(currentVersion, undefined, { numeric: true }) === 1;
    }

    const downloadUpdate = async (initial = false) => {
        const zipFilePath = `${dataDir}/update.zip`;
        const file = fs.createWriteStream(zipFilePath);
        https.get('https://codeload.github.com/switchlove/pokeclicker/zip/acsrq-beta', async res => {
            let cur = 0;
            try {
                if (!initial) await mainWindow.webContents.executeJavaScript(`Notifier.notify({ title: '[UPDATER] v${newVersion}', message: 'Downloading Files...<br/>Please Wait...', timeout: 1e6 })`);
            }catch(e){}

            res.on('data', async chunk => {
                cur += chunk.length;
                try {
                    if (initial) await mainWindow.webContents.executeJavaScript(`setStatus("Downloading Files...<br/>${(cur / 1048576).toFixed(2)} mb")`);
                }catch(e){}
            });

            res.pipe(file).on('finish', async () => {
                try {
                    if (initial) await mainWindow.webContents.executeJavaScript('setStatus("Files Downloaded!<br/>Extracting Files...")');
                    else await mainWindow.webContents.executeJavaScript(`Notifier.notify({ title: '[UPDATER] v${newVersion}', message: 'Files Downloaded!<br/>Extracting Files...', timeout: 2e4 })`);
                }catch(e){}

                const zip = new Zip(zipFilePath);

                const extracted = zip.extractEntryTo('pokeclicker-acsrq-beta/docs/', `${dataDir}`, true, true);

                fs.unlinkSync(zipFilePath);

                if (!extracted) {
                    return downloadUpdateFailed();
                }

                currentVersion = newVersion;
                startUpdateCheckInterval();

                // If this is the initial download, don't ask the user about refreshing the page
                if (initial) {
                    mainWindow.loadURL(`file://${dataDir}/pokeclicker-acsrq-beta/docs/index.html`);
                    return;
                    setTimeout(checkForUpdates, 3000);
                }

                const userResponse = dialog.showMessageBoxSync(mainWindow, {
                    title: 'PokeClicker - Update success!',
                    message: `Successfully updated,\nwould you like to reload the page now?`,
                    icon: `${__dirname}/icon.png`,
                    buttons: ['Yes', 'No'],
                    noLink: true,
                });

                if (userResponse == 0){
                    mainWindow.loadURL(`file://${dataDir}/pokeclicker-acsrq-beta/docs/index.html`);
                }
            });
        }).on('error', (e) => {
            return downloadUpdateFailed();
        });
    }

    const downloadUpdateFailed = () => {
        // If client exe updating, return
        if (windowClosed) return;

        const userResponse = dialog.showMessageBoxSync(mainWindow, {
            type: 'error',
            title: 'PokeClicker - Update failed!',
            message: `Failed to download or extract the update,\nWould you like to retry?`,
            icon: `${__dirname}/icon.png`,
            buttons: ['Yes', 'No'],
            noLink: true,
        });

        if (userResponse == 0) {
            downloadUpdate();
        }
    }

    const checkForUpdates = () => {
        const request = https.get('https://raw.githubusercontent.com/switchlove/pokeclicker/acsrq-beta/package.json', res => {
            let body = '';

            res.on('data', d => {
                body += d;
            });

            res.on('end', () => {
                let data = {version:'0.0.0'};
                try {
                    data = JSON.parse(body);
                    newVersion = data.version;
                    const newVersionAvailable = isNewerVersion(data.version);

                    if (newVersionAvailable) {
                        // Stop checking for updates
                        clearInterval(checkForUpdatesInterval);
                        // Check if user want's to update now
                        shouldUpdateNowCheck();
                    }
                }catch(e) {}
            });

        }).on('error', (e) => {
            // TODO: Update download failed
            console.warn('Couldn\'t check for updated version, might be offline..');
        });
    }

    const shouldUpdateNowCheck = () => {
        const userResponse = dialog.showMessageBoxSync(mainWindow, {
            title: 'PokeClicker - Update available!',
            message: `There is a new update available (v${newVersion}),\nWould you like to download it now?\n\n`,
            icon: `${__dirname}/icon.png`,
            buttons: ['Update Now', 'Remind Me', 'No (disable check)'],
            noLink: true,
        });

        switch (userResponse) {
            case 0:
                downloadUpdate();
                break;
            case 1:
                // Check again in 1 hour
                setTimeout(shouldUpdateNowCheck, 36e5)
                break;
            case 2:
                console.info('Update check disabled, stop checking for updates');
                break;
        }
    }

    const startUpdateCheckInterval = (run_now = false) => {
        // Check for updates every hour
        checkForUpdatesInterval = setInterval(checkForUpdates, 36e5)
        if (run_now) {
            checkForUpdates();
            checkForUpdatesA6();
        }
    }

    try {
        // If we can get our current version, start checking for updates once the game starts
        currentVersion = JSON.parse(fs.readFileSync(`${dataDir}/pokeclicker-acsrq-beta/docs/package.json`).toString()).version;
        if (currentVersion == '0.0.0') throw Error('Must re-download updated version');
        setTimeout(() => {
            startUpdateCheckInterval(true);
        }, 1e4)
    } catch (e) {
        // Game not downloaded yet
        downloadUpdate(true);
        console.log('downloading...');
    }

    try {
        autoUpdater.on('update-downloaded', () => {
            const userResponse = dialog.showMessageBoxSync(mainWindow, {
                title: 'PokeClicker - Client Update Available!',
                message: `There is a new client update available,\nWould you like to install it now?\n\n`,
                icon: `${__dirname}/icon.png`,
                buttons: ['Restart App Now', 'Later'],
                noLink: true,
            });

            switch (userResponse) {
                case 0:
                    windowClosed = true;
                    autoUpdater.quitAndInstall(true, true);
                    break;
            }
        });
        autoUpdater.checkForUpdatesAndNotify()
    } catch (e) {}

    /*
    ACSRQ UPDATE STUFF
    */
    const checkForUpdatesA6 = () => {
        currentVersionA6 = JSON.parse(fs.readFileSync(`${dataDir}/pokeclicker-acsrq-beta/docs/acsrq.json`).toString()).version;
        const request = https.get('https://raw.githubusercontent.com/switchlove/pokeclicker/acsrq-beta/docs/acsrq.json', res => {
            let body = '';

            res.on('data', d => {
                body += d;
            });

            res.on('end', () => {
                let data = {version:'0.0.0'};
                try {
                    data = JSON.parse(body);
                    newVersionA6 = data.version;
                    newFilesA6 = data.files;
                    const newVersionAvailable = data.version.localeCompare(currentVersionA6, undefined, { numeric: true }) === 1
                    if (newVersionAvailable) {
                        const userResponse = dialog.showMessageBoxSync(mainWindow, {
                            title: 'ACSRQ - Script update available!',
                            message: `There is a new script update available (v${newVersionA6}),\nWould you like to download it now?\n\n`,
                            icon: `${__dirname}/icon.png`,
                            buttons: ['Update Now', 'Remind Me', 'No (disable check)'],
                            noLink: true,
                        });

                        switch (userResponse) {
                            case 0:
                                newDownloaded = 0;
                                downloadUpdateA6(newFilesA6);
                                break;
                            case 1:
                                // Check again in 1 hour
                                setTimeout(checkForUpdatesA6, 36e5)
                                break;
                            case 2:
                                console.info('Update check disabled, stop checking for updates');
                                break;
                        }
                    }
                } catch(e) {}
            });

        }).on('error', (e) => {
            // TODO: Update download failed
            console.warn('Couldn\'t check for updated version, might be offline..');
        });
    }

    async function downloadCheckA6() {
        newDownloaded++;
        if (newDownloaded === 3) downloadCompleteA6();
    }

    async function downloadUpdateA6(newFilesA6) {
        const files = newFilesA6;
        for (const x of files) {
            const file = fs.createWriteStream(`${dataDir}/pokeclicker-acsrq-beta/docs/${x}`);
            https.get(`https://raw.githubusercontent.com/switchlove/pokeclicker/acsrq-beta/docs/${x}`, async res => {
                res.pipe(file).on('finish', async () => {
                    downloadCheckA6();
                });
            }).on('error', (e) => {
              return downloadUpdateFailed();
            });
        }
    }

    async function downloadCompleteA6() {
        currentVersionA6 = newVersionA6;
        const fileName1 = `${dataDir}/pokeclicker-acsrq-beta/docs/acsrq.json`;
        const file1 = require(fileName1);
        file1.version = newVersionA6;
        fs.writeFile(fileName1, JSON.stringify(file1), function writeJSON(err) {
            if (err) return console.log(err);
        });

        const userResponse = dialog.showMessageBoxSync(mainWindow, {
            title: 'ACSRQ - Update success!',
            message: `Successfully updated,\nwould you like to reload the page now?`,
            icon: `${__dirname}/icon.png`,
            buttons: ['Yes', 'No'],
            noLink: true,
        });

        if (userResponse == 0){
            mainWindow.loadURL(`file://${dataDir}/pokeclicker-acsrq-beta/docs/index.html`);
        }
    }

}
