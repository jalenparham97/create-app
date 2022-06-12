import path from 'path';
import fs from 'fs';
import { access } from 'fs/promises';
import { promisify } from 'util';

import chalk from 'chalk';
import ncp from 'ncp';
import execa from 'execa';
import Listr from 'listr';
import { projectInstall } from 'pkg-install';

const copy = promisify(ncp);

async function copyTemplateFiles(options) {
  return copy(options.templateDirectory, options.targetDirectory, {
    clobber: false,
  });
}

async function initGit(options) {
  const result = await execa('git', ['init'], {
    cwd: options.targetDirectory,
  });

  if (result.failed) {
    return Promise.reject(new Error('Failed to initialize git'));
  }
  return;
}

export async function createApp(options) {
  options = {
    ...options,
    targetDirectory: options.appName || process.cwd(),
  };

  const template = options.template.toLowerCase();

  const currentFileUrl = import.meta.url;
  const pathUrl = new URL(currentFileUrl).pathname;
  const templateDir = path.resolve(pathUrl, '../../templates', template);
  options.templateDirectory = templateDir;

  try {
    await access(templateDir, fs.constants.R_OK);
  } catch (err) {
    console.error('%s Invalid template name', chalk.red.bold('ERROR'));
    process.exit(1);
  }

  const defaultTasks = [
    {
      title: 'Copy app files',
      task: () => copyTemplateFiles(options),
    },
    {
      title: 'Initialize git',
      task: () => initGit(options),
      enabled: () => options.git,
    },
  ];

  const tasksToRun =
    template === 'vanilla-javascript'
      ? defaultTasks
      : [
          ...defaultTasks,
          {
            title: 'Install dependencies',
            task: () =>
              projectInstall({
                cwd: options.targetDirectory,
              }),
            skip: () =>
              !options.runInstall
                ? 'Pass --install to automatically install dependencies'
                : undefined,
          },
        ];

  const tasks = new Listr(tasksToRun);

  await tasks.run();

  console.log('%s App is ready', chalk.green.bold('DONE'));
  return true;
}
