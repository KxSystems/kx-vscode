# Release process for KX VSCode extension

The release process for the extension requires multiple steps. Some of these are automated with scripts and can be called from future CI/CD platforms, such as Azure DevOps or GitHub workflows. Currently this process is quite manual as the extension is not published to the marketplace yet.

## Steps for creating a new release

1. Build the extension and run all tests.

```
yarn install
yarn run build
yarn run test
```

2. Run the extension in developer mode to test that the functionality of the change is valid.

```
Press <F5>, wait for extension host to launch, tests functionality
```

3. Update the [package.json](package.json) to bump the version for the extension. This is important because when installing the package (VSIX), it's important to have the updated version to ensure VSCode does not install another version. This applies after the extension is published to the marketplace. This uses semantic version of build.release.patch (e.g., 0.1.8)

4. Update the [CHANGELOG.md](CHANGELOG.md) to include the release version the the appropriate comments on updates.

5. Package the extension. This will create the bundled extension (essentially compressing and minifing all code to a single js file) and then creating the manifest and assets for what will be published to the marketplace. This will output a VSIX file, which is a compressed file of these assets.

```
yarn run package
```

6. Start a new VS Code instance and install the extension by sideloading. This is done by navigating to the extensions tab and from the ellipse menu click on 'Install from VSIX'. Again, run the same tests as in step above. This is used to validate that the bundling/miniflying and compression didn't result in any breakage.

7. Share the VSIX with team members, get feedback.

8. After this is completed, a release can be created in GitHub. This _can_ be automated but currently is manual.

   - First, create a new draft release in the GitHub repo
   - Name the release v0.1.x to ensure the version matches the new version.
   - Copy the section for the version from the [CHANGELOG.md](CHANGELOG.md) to the notes.
   - Add the VSIX as a binary for the release.
