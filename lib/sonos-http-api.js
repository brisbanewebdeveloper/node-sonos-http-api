'use strict';
const requireDir = require('./helpers/require-dir');
const path = require('path');
const request = require('sonos-discovery/lib/helpers/request');
const url = require('url');
const logger = require('sonos-discovery/lib/helpers/logger');
const HttpEventServer = require('./helpers/http-event-server');

function getErrorMessage(error, fallbackMessage) {
  if (error && typeof error.message === 'string' && error.message) {
    return error.message;
  }

  if (error && typeof error.error === 'string' && error.error) {
    return error.error;
  }

  if (typeof error === 'string' && error) {
    return error;
  }

  return fallbackMessage;
}

function buildErrorBody(error, fallbackMessage) {
  const body = {
    status: 'error',
    error: getErrorMessage(error, fallbackMessage)
  };

  if (error && typeof error.stack === 'string' && error.stack) {
    body.stack = error.stack;
  }

  return body;
}

function resolveActionRequest(actions, discovery, params) {
  const targetName = decodeURIComponent(params[0] || '');
  const scopedAction = (params[1] || '').toLowerCase();
  let player = discovery.getPlayer(targetName);

  if (player) {
    return {
      player,
      action: scopedAction,
      values: params.slice(2)
    };
  }

  const action = (params[0] || '').toLowerCase();

  if (actions[action]) {
    player = discovery.getAnyPlayer();
    return {
      player,
      action,
      values: params.slice(1)
    };
  }

  if (scopedAction && actions[scopedAction]) {
    return {
      statusCode: 404,
      error: `Player '${targetName}' not found.`
    };
  }

  player = discovery.getAnyPlayer();
  return {
    player,
    action,
    values: params.slice(1)
  };
}

function HttpAPI(discovery, settings) {

  const port = settings.port;
  const webroot = settings.webroot;
  const actions = {};
  const events = new HttpEventServer();

  this.getWebRoot = function () {
    return webroot;
  };

  this.getPort = function () {
    return port;
  };

  this.discovery = discovery;

  discovery.on('transport-state', function (player) {
    invokeWebhook('transport-state', player);
  });

  discovery.on('topology-change', function (topology) {
    invokeWebhook('topology-change', topology);
  });

  discovery.on('volume-change', function (volumeChange) {
    invokeWebhook('volume-change', volumeChange);
  });

  discovery.on('mute-change', function (muteChange) {
    invokeWebhook('mute-change', muteChange);
  });

  // this handles registering of all actions
  this.registerAction = function (action, handler) {
    actions[action] = handler;
  };

  //load modularized actions
  requireDir(path.join(__dirname, './actions'), (registerAction) => {
    registerAction(this);
  });

  this.requestHandler = function (req, res) {
    if (req.url === '/favicon.ico') {
      res.end();
      return;
    }

    if (req.url === '/events') {
      events.addClient(res);
      return;
    }

    logger.info(`Received request: ${req.url} from ${req.socket.remoteAddress}`);

    // Add this to see more details about the client
    if (req.url.toLowerCase().includes('tts')) {
      logger.info(`TTS Request headers: ${JSON.stringify(req.headers)}`);
    }

    if (discovery.zones.length === 0) {
      const msg = 'No system has yet been discovered. Please see https://github.com/jishi/node-sonos-http-api/issues/77 if it doesn\'t resolve itself in a few seconds.';
      logger.error(msg);
      sendResponse(500, { status: 'error', error: msg });
      return;
    }

    // logger.info(`req.url: ${req.url}`);
    const params = req.url.substring(1).split('/');

    let requestOptions;
    try {
      requestOptions = resolveActionRequest(actions, discovery, params);
    } catch (error) {
      logger.error(`Unable to parse supplied URI component (${params[0]})`, error);
      return sendResponse(500, buildErrorBody(error, 'Unable to parse the supplied URI component.'));
    }

    if (requestOptions.error) {
      logger.error(requestOptions.error);
      return sendResponse(requestOptions.statusCode || 500, buildErrorBody(requestOptions.error, 'Unable to resolve the target player.'));
    }

    const parsedUrl = url.parse(req.url, true);
    requestOptions.query = parsedUrl.query;

    function sendResponse(code, body) {
      var jsonResponse = JSON.stringify(body);
      res.statusCode = code;
      res.setHeader('Content-Length', Buffer.byteLength(jsonResponse));
      res.setHeader('Content-Type', 'application/json;charset=utf-8');
      res.write(Buffer.from(jsonResponse));
      res.end();
    }

    Promise.resolve(handleAction(requestOptions))
    .then((response) => {
      if (!response || response.constructor.name === 'IncomingMessage') {
        response = { status: 'success' };
      } else if (Array.isArray(response) && response.length > 0 && response[0].constructor.name === 'IncomingMessage') {
        response = { status: 'success' };
      }

      sendResponse(200, response);
    }).catch((error) => {
      logger.error(error);
      sendResponse(500, buildErrorBody(error, 'An unexpected Sonos API error occurred.'));
    });
  };


  function handleAction(options) {
    var player = options.player;

    if (!actions[options.action]) {
      return Promise.reject({ error: 'action \'' + options.action + '\' not found' });
    }

    return actions[options.action](player, options.values, options.query);


  }

  function invokeWebhook(type, data) {
    var typeName = "type";
    var dataName = "data";

    if (settings.webhookType) { typeName = settings.webhookType; }
    if (settings.webhookData) { dataName = settings.webhookData; }

    const jsonBody = JSON.stringify({
      [typeName]: type,
      [dataName]: data
    });

    events.sendEvent(jsonBody);

    if (!settings.webhook) return;

    const body = Buffer.from(jsonBody, 'utf8');

    var headers = {
        'Content-Type': 'application/json',
        'Content-Length': body.length
      }
    if (settings.webhookHeaderName && settings.webhookHeaderContents) {
      headers[settings.webhookHeaderName] = settings.webhookHeaderContents;
    }

    request({
      method: 'POST',
      uri: settings.webhook,
      headers: headers,
      body
    })
    .catch(function (err) {
      logger.error('Could not reach webhook endpoint', settings.webhook, 'for some reason. Verify that the receiving end is up and running.');
      logger.error(err);
    })
  }

}

module.exports = HttpAPI;
module.exports._test = {
  buildErrorBody,
  getErrorMessage,
  resolveActionRequest
};
