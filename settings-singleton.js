'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('sonos-discovery/lib/helpers/logger');
const tryLoadJson = require('./lib/helpers/try-load-json');

let settings = {};

module.exports = (baseDir) => {
  if (settings.baseDir) {
    return settings;
  }

  settings = {
    port: 5005,
    ip: '0.0.0.0',
    securePort: 5006,
    cacheDir: path.resolve(baseDir, 'cache'),
    webroot: path.resolve(baseDir, 'static'),
    presetDir: path.resolve(baseDir, 'presets'),
    announceVolume: 40,
    baseDir,
  };

  // load user settings
  const settingsFileFullPath = path.resolve(baseDir, 'settings.json');

  // check if the file exists
  if (fs.existsSync(settingsFileFullPath)) {
    const userSettings = tryLoadJson(settingsFileFullPath);
    settings = { ...settings, userSettings };
  }
  logger.debug(settings);

  if (!fs.existsSync(`${settings.webroot}/tts/`)) {
    fs.mkdirSync(`${settings.webroot}/tts/`);
  }

  if (!fs.existsSync(settings.cacheDir)) {
    try {
      fs.mkdirSync(settings.cacheDir);
    } catch (err) {
      logger.warn(`Could not create cache directory ${settings.cacheDir}, please create it manually for all feature
es to work.`);
    }
  }

  return settings;
};
