# Release process for KX VSCode extension

On each push to Main or Dev there is a vsix built and uploaded to [Downloads Portal](https://portal.dl.kx.com/assets/raw/kdb-vscode/)

## Steps for creating a new release

1. Update the [package.json](package.json) to bump the version for the extension. This is important because when installing the package (VSIX), it's important to have the updated version to ensure VSCode does not install another version. This applies after the extension is published to the marketplace. This uses semantic version of build.release.patch (e.g., 0.1.8)

2. Update the [CHANGELOG.md](CHANGELOG.md) to include the release version the the appropriate comments on updates. This uses semantic version of build.release.patch (e.g., v0.1.8)

3. Merge the changes

4. Create a tag on main locally, then push it to remote.
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
