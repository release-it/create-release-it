#!/usr/bin/env node

import fs from 'fs';
import util from 'util';
import { EOL } from 'os';
import prompts from 'prompts';
import gitRemoteOriginUrl from 'git-remote-origin-url';
import parseGitUrl from 'git-url-parse';
import { execa } from 'execa';

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

  // console.log('process.env.npm_config_user_agent', process.env.npm_config_user_agent)
  const usedPM = getUsedPM();

  let pm = null;
  let addPkgCmd = null;
  switch (usedPM) {
    case 'pnpm':
    case 'yarn':
      pm = usedPM
      addPkgCmd = 'add';
    case 'npm':
    case 'cnpm':
    default:
      pm = usedPM || 'npm';
      addPkgCmd = 'install'
      break;
  }

  await execa(pm, [addPkgCmd, 'release-it', '--save-dev'], { stdio: 'inherit' });
})();

function getUsedPM() {
  if (!process.env.npm_config_user_agent) {
    return undefined
  }
  return pmFromUserAgent(process.env.npm_config_user_agent)
}

function pmFromUserAgent (userAgent) {
  const pmSpec = userAgent.split(' ')[0]
  const separatorPos = pmSpec.lastIndexOf('/')
  const name = pmSpec.substring(0, separatorPos)
  return name === 'npminstall' ? 'cnpm' : name
}
