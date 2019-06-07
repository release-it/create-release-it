# create-release-it

To add release-it to any project:

```
npm init release-it
```

This temporarily installs `create-release-it` (this project), and runs [the `bin` script](./index.js) in
`./package.json`. This script will install [release-it](https://github.com/release-it/release-it) to the project, and
add basic configuration to either `.release-it.json` or `package.json`.

Also see [npm-init](https://docs.npmjs.com/cli/init).
