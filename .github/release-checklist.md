# Release Checklist

Use this checklist when publishing a new desktop build.

## Beta release

Use beta releases to test updater behavior safely before broad rollout.

- [ ] Set `package.json` version to a prerelease value like `1.3.0-beta.1`
- [ ] Commit and push the release commit
- [ ] Create a Git tag like `v1.3.0-beta.1`
- [ ] Create a GitHub release from that tag and mark it as **This is a pre-release**
- [ ] Confirm the workflow shows `Release channel: beta`
- [ ] Confirm `beta*.yml` update metadata is uploaded with the installers
- [ ] Verify the app updates correctly from an existing beta install
- [ ] Confirm the generated `SHA256SUMS.txt` appears in the release assets

## Stable release

Use stable releases for broad distribution.

- [ ] Set `package.json` version to a stable value like `1.3.0`
- [ ] Commit and push the release commit
- [ ] Create a Git tag like `v1.3.0`
- [ ] Create a normal GitHub release from that tag (do **not** mark as prerelease)
- [ ] Confirm the workflow shows `Release channel: latest`
- [ ] Confirm `latest*.yml` update metadata is uploaded with the installers
- [ ] Verify the app updates correctly from the previous stable install
- [ ] Confirm the generated `SHA256SUMS.txt` appears in the release assets

## Preflight checks for both

- [ ] `npm ci`
- [ ] `npm run dist:tux`
- [ ] `npm run dist:mac`
- [ ] `npm run dist:win32`
- [ ] `npm run dist:win64`
- [ ] Review generated artifact names for consistency
- [ ] Sanity-check the GitHub release notes before publishing
