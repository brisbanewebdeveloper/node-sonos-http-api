'use strict';
const tryDownloadTTS = require('../helpers/try-download-tts');
const allPlayerAnnouncement = require('../helpers/all-player-announcement');
const settings = require('../../settings');
const restoreBuffer = settings.restoreBuffer || 2000;
const logger = require('sonos-discovery/lib/helpers/logger');

let port;
// let system;

function sayAll(player, values, query) {
  let text;
  try {
    text = decodeURIComponent(values[0]);
  } catch (err) {
    if (err instanceof URIError) {
      err.message = `The encoded phrase ${values[0]} could not be URI decoded. Make sure your url encoded values (%xx) are within valid ranges. xx should be hexadecimal representations`;
    }
    return Promise.reject(err);
  }
  let announceVolume;
  let language;

  // logger.info(`values: ${JSON.stringify(values)}`);

  if (/^\d+$/i.test(values[1])) {
    // first parameter is volume
    announceVolume = values[1];
    // language = 'en-gb';
  } else {
    language = values[1];
    announceVolume = values[2] || settings.announceVolume || 40;
  }

  const duration = result.duration + restoreBuffer;

  return tryDownloadTTS(text, language, query)
    .then((result) => {
      return allPlayerAnnouncement(player.system, `http://${player.system.localEndpoint}:${port}${result.uri}`, announceVolume, duration);
    })

}

module.exports = function (api) {
  logger.info(`Restore Buffer: ${restoreBuffer}ms`);
  port = api.getPort();
  api.registerAction('sayall', sayAll);
};
