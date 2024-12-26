#!/usr/bin/env node

import fs from 'fs';
import util from 'util';
import { EOL } from 'os';
import prompts from 'prompts';
import gitRemoteOriginUrl from 'git-remote-origin-url';
import parseGitUrl from 'git-url-parse';
import { execa } from 'execa';
import { detect } from 'detect-package-manager';

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const RELEASE_IT_CONFIG = '.release-it.json';
const PACKAGE_CONFIG = 'package.json';

(async () => {
  let manifest = {};
  let hasManifest = false;
  let isManifestChanged = false;

  let config = {};
  let hasConfig = false;
  let isConfigChanged = false;

  let isGitHub = false;
  let isGitLab = false;
  let remoteUrl;

  try {
    manifest = JSON.parse(await readFile(PACKAGE_CONFIG));
    hasManifest = true;
  } catch (err) {}

  try {
    config = JSON.parse(await readFile(RELEASE_IT_CONFIG));
    hasConfig = true;
  } catch (err) {}

  config = {
    $schema: 'https://unpkg.com/release-it/schema/release-it.json',
    ...config
  };

  try {
    remoteUrl = await gitRemoteOriginUrl();
  } catch (err) {}

  if (remoteUrl) {
    const parsedRemoteUrl = parseGitUrl(remoteUrl);
    isGitHub = parsedRemoteUrl.host.includes('github.com');
    isGitLab = parsedRemoteUrl.host.includes('gitlab.com');
  }

  const questions = [];

  if (isGitHub) {
    questions.push({
      type: 'confirm',
      name: 'github',
      message: 'Publish a GitHub Release with every release?',
      initial: true
    });
  }

  if (isGitLab) {
    questions.push({
      type: 'confirm',
      name: 'gitlab',
      message: 'Publish a GitLab Release with every release?',
      initial: true
    });
  }

  if (hasManifest) {
    questions.push({
      type: 'select',
      name: 'config',
      message: 'Where to add the release-it config?',
      choices: [
        { title: '.release-it.json', value: RELEASE_IT_CONFIG },
        { title: 'package.json', value: PACKAGE_CONFIG }
      ],
      initial: 0,
      hint: ' '
    });
  }

  const answers = await prompts(questions);

  if (answers.github) {
    config.github = {
      release: true
    };
    isConfigChanged = true;
  }

  if (answers.gitlab) {
    config.gitlab = {
      release: true
    };
    isConfigChanged = true;
  }

  if (hasManifest) {
    manifest.scripts = manifest.scripts || {};
    if (!('release' in manifest.scripts)) {
      manifest.scripts.release = 'release-it';
      isManifestChanged = true;
    }
  }

  if (isConfigChanged && (!answers.config || answers.config === RELEASE_IT_CONFIG)) {
    await writeFile(RELEASE_IT_CONFIG, JSON.stringify(config, null, '  ') + EOL);
  }

  if (answers.config === PACKAGE_CONFIG) {
    manifest['release-it'] = config;
    isManifestChanged = true;
  }
  if (isManifestChanged) {
    await writeFile(PACKAGE_CONFIG, JSON.stringify(manifest, null, '  ') + EOL);
  }

  let currentPackageManager;
  try {
    currentPackageManager = await detect();
  } catch (error) {
    console.warn('Failed to detect package manager, falling back to npm');
    currentPackageManager = 'npm';
  }

  const packageManagerCommands = {
    npm: () => execa('npm', ['install', 'release-it', '-D'], { stdio: 'inherit' }),
    pnpm: () => execa('pnpm', ['add', 'release-it', '-D'], { stdio: 'inherit' }),
    yarn: () => execa('yarn', ['add', 'release-it', '-D'], { stdio: 'inherit' }),
    bun: () => execa('bun', ['add', 'release-it', '-D'], { stdio: 'inherit' })
  };

  try {
    console.log(`Installing release-it using ${currentPackageManager}...`);
    const installDependency = packageManagerCommands[currentPackageManager] || packageManagerCommands.npm;
    await installDependency();
    console.log('Successfully installed release-it');
  } catch (error) {
    console.error('Failed to install release-it:', error.message);
    process.exit(1);
  }
})();
