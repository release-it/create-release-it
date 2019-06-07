#!/usr/bin/env node

const fs = require('fs');
const util = require('util');
const { EOL } = require('os');
const prompts = require('prompts');
const gitRemoteOriginUrl = require('git-remote-origin-url');
const parseGitUrl = require('git-url-parse');
const execa = require('execa');

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

  try {
    remoteUrl = await gitRemoteOriginUrl();
  } catch (err) {}

  if (remoteUrl) {
    const parsedRemoteUrl = parseGitUrl(remoteUrl);
    isGitHub = parsedRemoteUrl.source === 'github.com';
    isGitLab = parsedRemoteUrl.source === 'gitlab.com';
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

  await execa('npm', ['install', 'release-it', '--save-dev'], { stdio: 'inherit' });
})();
