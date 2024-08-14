'use strict';

const requireDir = require('./helpers/require-dir');
const path = require('path');
const request = require('sonos-discovery/lib/helpers/request');
const logger = require('sonos-discovery/lib/helpers/logger');
const HttpEventServer = require('./helpers/http-event-server');

function HttpAPI(discovery, settings) {
  const { port, webroot } = settings;
  const actions = {};
  const events = new HttpEventServer();

  function invokeWebhook(type, data) {
    let typeName = 'type';
    let dataName = 'data';

    if (settings.webhookType) { typeName = settings.webhookType; }
    if (settings.webhookData) { dataName = settings.webhookData; }

    const jsonBody = JSON.stringify({
      [typeName]: type,
      [dataName]: data
    });

    events.sendEvent(jsonBody);

    if (!settings.webhook) return;

    const body = Buffer.from(jsonBody, 'utf8');

    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': body.length
    };
    if (settings.webhookHeaderName && settings.webhookHeaderContents) {
      headers[settings.webhookHeaderName] = settings.webhookHeaderContents;
    }

    request({
      method: 'POST',
      uri: settings.webhook,
      headers,
      body
    }).catch((err) => {
      logger.error('Could not reach webhook endpoint', settings.webhook, 'for some reason. Verify that the receiving end is up and running.');
      logger.error(err);
    });
  }

  this.getWebRoot = () => webroot;
  this.getPort = () => port;

  this.discovery = discovery;

  discovery.on('transport-state', player => invokeWebhook('transport-state', player));
  discovery.on('topology-change', topology => invokeWebhook('topology-change', topology));
  discovery.on('volume-change', volumeChange => invokeWebhook('volume-change', volumeChange));
  discovery.on('mute-change', muteChange => invokeWebhook('mute-change', muteChange));

  // this handles registering of all actions
  this.registerAction = (action, handler) => {
    actions[action] = handler;
  };

  // load modularized actions
  requireDir(path.join(__dirname, './actions'), (registerAction) => {
    registerAction(this);
  });

  this.requestHandler = (req, res) => {
    if (req.url === '/favicon.ico') {
      res.end();
      return;
    }

    function sendResponse(code, body) {
      const jsonResponse = JSON.stringify(body);
      res.statusCode = code;
      res.setHeader('Content-Length', Buffer.byteLength(jsonResponse));
      res.setHeader('Content-Type', 'application/json;charset=utf-8');
      res.write(Buffer.from(jsonResponse));
      res.end();
    }

    // Return some settings in settings.json
    // - It needs to extend if more settings are added
    if (req.url === '/settings.json') {
      sendResponse(
        200,
        {
          port: settings.port,
          ip: settings.ip,
          securePort: settings.securePort,
          announceVolume: settings.announceVolume,
          updateNowPlayingInterval: settings.updateNowPlayingInterval,
        },
      );
      return;
    }


    if (req.url === '/events') {
      events.addClient(res);
      return;
    }

    if (discovery.zones.length === 0) {
      const msg = 'No system has yet been discovered. Please see https://github.com/jishi/node-sonos-http-api/issues/77 if it doesn\'t resolve itself in a few seconds.';
      logger.error(msg);
      sendResponse(500, { status: 'error', error: msg });
      return;
    }

    const params = req.url.substring(1).split('/');

    // parse decode player name considering decode errors
    let player;
    try {
      player = discovery.getPlayer(decodeURIComponent(params[0]));
    } catch (error) {
      logger.error(`Unable to parse supplied URI component (${params[0]})`, error);
      sendResponse(500, { status: 'error', error: error.message, stack: error.stack });
      return;
    }

    const opt = {};

    if (player) {
      opt.action = (params[1] || '').toLowerCase();
      opt.values = params.splice(2);
    } else {
      player = discovery.getAnyPlayer();
      opt.action = (params[0] || '').toLowerCase();
      opt.values = params.splice(1);
    }

    function handleAction(options) {
      const { player: tmpPlayer } = options;

      if (!actions[options.action]) {
        return Promise.reject(new Error(`action '${options.action}' not found`));
      }

      return actions[options.action](tmpPlayer, options.values);
    }

    opt.player = player;
    Promise.resolve(handleAction(opt)).then((response) => {
      if (!response || response.constructor.name === 'IncomingMessage') {
        response.status = 'success';
      } else if (Array.isArray(response) && response.length > 0 && response[0].constructor.name === 'IncomingMessage') {
        response.status = 'success';
      }

      sendResponse(200, response);
    }).catch((error) => {
      logger.error(error);
      sendResponse(500, { status: 'error', error: error.message, stack: error.stack });
    });
  };
}

module.exports = HttpAPI;
