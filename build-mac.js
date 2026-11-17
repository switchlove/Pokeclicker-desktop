// Builds the macOS DMG (or the Linux deb) on a Mac over ssh and copies the result into dist/.
//
//   npm run dist:mac:remote                  -> npm run dist:mac on the Mac
//   npm run dist:tux:remote                  -> npm run dist:tux on the Mac
//   npm run dist:mac:remote -- <script>      -> any other npm script
//
// The Mac is the ssh host "macbuild" (an alias in ~/.ssh/config), or MAC_BUILD_HOST.
// In one ssh session: the working tree (minus node_modules, dist, .git) is
// streamed to ~/pokeclicker-desktop-build, built there, and the artifacts are
// streamed back as a tar on stdout. Build logs go to stderr.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const fail = (msg) => {
    console.error(`[build-mac] ${msg}`);
    process.exit(1);
};

const host = process.env.MAC_BUILD_HOST || 'macbuild';
const script = process.argv[2] || 'dist:mac';
if (!/^[\w:.-]+$/.test(script)) fail(`Invalid npm script name: ${script}`);

const remoteScript = `
set -euo pipefail
SCRIPT="$1"
DIR="$HOME/pokeclicker-desktop-build"
mkdir -p "$DIR"
cd "$DIR"

# Fresh sources each build; keep node_modules so npm ci can be skipped.
find . -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} +
tar -xzf -

export NVM_DIR="$HOME/.nvm"
set +u; . "$NVM_DIR/nvm.sh"; nvm install >&2; set -u

HASH="$(node -v) $(shasum -a 256 package-lock.json | cut -d' ' -f1)"
if [ "$(cat node_modules/.lockhash 2>/dev/null || true)" != "$HASH" ]; then
    echo "[build-mac] package-lock.json or Node changed, running npm ci" >&2
    npm ci >&2
    echo "$HASH" > node_modules/.lockhash
fi

# No signing cert is configured; don't let electron-builder find a keychain
# identity and block on a keychain prompt over ssh.
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run "$SCRIPT" >&2

cd dist
shopt -s nullglob
FILES=(*.dmg *.deb *.blockmap latest*.yml beta*.yml)
if [ \${#FILES[@]} -eq 0 ]; then
    echo "[build-mac] Build finished but produced no artifacts in dist/" >&2
    exit 1
fi
echo "[build-mac] Artifacts: \${FILES[*]}" >&2
COPYFILE_DISABLE=1 tar -cf - "\${FILES[@]}"
`;

// The source tar uses ssh's stdin, so the script travels base64-encoded in the
// command line (safe through Windows argument quoting) and is decoded remotely.
// bash -l picks up the login PATH (Homebrew), which plain ssh commands lack.
// Strip \r so a CRLF checkout (core.autocrlf) can't break the remote bash script.
const b64 = Buffer.from(remoteScript.replace(/\r/g, '')).toString('base64');
const remoteCmd = `bash -lc "$(echo ${b64} | base64 -d)" build-mac ${script}`;

const dist = path.join(__dirname, 'dist');
fs.mkdirSync(dist, { recursive: true });

console.log(`[build-mac] Running npm run ${script} on ${host}`);
const pack = spawn('tar', ['-czf', '-', '--exclude=node_modules', '--exclude=dist', '--exclude=.git', '-C', __dirname, '.'],
    { stdio: ['ignore', 'pipe', 'inherit'] });
const ssh = spawn('ssh', [host, remoteCmd], { stdio: ['pipe', 'pipe', 'inherit'] });
const unpack = spawn('tar', ['-xf', '-', '-C', dist], { stdio: ['pipe', 'inherit', 'inherit'] });
pack.stdout.pipe(ssh.stdin);
ssh.stdout.pipe(unpack.stdin);
// If one side dies early the pipe breaks; the exit codes below report why.
ssh.stdin.on('error', () => {});
unpack.stdin.on('error', () => {});
// The remote side reads all of stdin before building, so the source tar has
// normally finished by now; if ssh died early, it would block forever instead.
ssh.on('close', () => { if (pack.exitCode === null) pack.kill(); });

const exited = (proc, name) => new Promise((resolve) => {
    proc.on('error', (err) => fail(`Could not run ${name}: ${err.message}`));
    proc.on('close', resolve);
});
Promise.all([exited(pack, 'tar'), exited(ssh, 'ssh'), exited(unpack, 'tar')]).then(([packCode, sshCode, unpackCode]) => {
    if (sshCode !== 0) fail(`Remote build on ${host} failed (exit ${sshCode}).`);
    if (packCode !== 0) fail(`Packing the source failed (exit ${packCode}).`);
    if (unpackCode !== 0) fail(`Unpacking the artifacts into dist/ failed (exit ${unpackCode}).`);
    console.log(`[build-mac] Done: artifacts are in ${dist}`);
});
