'use strict';

var request = require('request');
var pluginUtils = require('../lib/plugin-utils');
var defaultVersion = require('./server-version.json');
var sdkVersion = '1.0.2';
var putils = require('./plugin-utils');
var liaVersion;
var supportedMinVersionForThemeCheck = '22.7';

module.exports = function (gulp, gutil) {
  var versionPattern = /(\d+)\.(\d{0,2})*/i;
  function validate(serverUrl, pluginToken, opts, cb, errorCallback) {

    var options = {
      headers: {
        Authorization: 'Bearer ' + pluginToken
      },
      rejectUnauthorized: false
    };
    var serverVersion = opts.version === undefined ? defaultVersion : opts.version;

    var versionCheckUrl = pluginUtils.urlBldr(serverUrl + '/restapi/ldntool/plugins/version?format=json').build();
    if (opts.debugMode) {
      putils.logDebug(gutil, 'making version check call to ' + versionCheckUrl);
      putils.logDebug(gutil, 'version check callOpts: ' + JSON.stringify(options));
    }
    request(versionCheckUrl, options, function (error, response, body) {
      if (opts.debugMode) {
        putils.logDebug(gutil, 'response from version check: \n' + body);
      }
      if (error || response.statusCode > 201) {
        process.exitCode = 1;
        putils.logError(gutil, 'got an error when trying to make the call: \n' + error);
        parseResponse(body, opts, errorCallback);
        return;
      }
      try {
        var versionResponse = parseResponse(body, opts, errorCallback);
        var version = versionResponse.version;
        var matches = version.toString().match(versionPattern);
        if (!matches || matches.length < 3) {
          process.exitCode = 1;
          callbackOrThrowError(errorCallback, 'Invalid version check response ' + version);
          return;
        }
        var versionOnServer = parseInt(matches[1]);
        var minorVersionOnServer = parseInt(matches[2]);
        if (versionOnServer < serverVersion.supportedVersionMajor ||
          (versionOnServer === serverVersion.supportedVersionMajor &&
          minorVersionOnServer < serverVersion.supportedVersionMinor)) {
          process.exitCode = 1;
          var errorMessage = 'Supported minimum version on server is ' + serverVersion.supportedVersionMajor +
            '.' + serverVersion.supportedVersionMinor + '.';
          pluginUtils.logError(gutil, errorMessage);
          errorMessage += ' Either contact support to get your stage server upgraded to version ' +
            serverVersion.supportedVersionMajor + '.' + serverVersion.supportedVersionMinor +
            ' or else downgrade your version of the sdk (Run npm install -g lithium-sdk@' + sdkVersion+')';
          callbackOrThrowError(errorCallback, errorMessage);
        }

        if (version < supportedMinVersionForThemeCheck) {
          putils.logWarning(gutil, "This version of community doesn't support rendering custom theme skins! Pls upgrade your community to version " +
            supportedMinVersionForThemeCheck + " or newer to get this feature.");
        }

        //On success invoke callback function
        if (typeof cb === 'function') {
          return cb();
        }
      } catch (error) {
        process.exitCode = 1;
        callbackOrThrowError(errorCallback, error.message);
      }

    });
  }

  function process(server, opts, cb, errorCallback) {
    if (server.serverUrl() === undefined) {
      var errMessage = 'A server URL is required in your configuration. ';
      callbackOrThrowError(errorCallback, errMessage);
    }
    validate(server.serverUrl(), server.pluginToken(), opts, cb, errorCallback);
  }

  function callbackOrThrowError(cb, errorMsg) {
    if (typeof cb === 'function') {
      cb(new Error(errorMsg), null);
    } else {
      var error = new Error(errorMsg);
      Error.captureStackTrace(error, callbackOrThrowError);
      throw error;
    }
  }

  function parseResponse(body, opts, errorCallback) {
    var errorMessage = 'Empty version check response';
    var badResponseErrMessage = 'Invalid response from server. Check your server url and version.';
    if ( !body ) {
      process.exitCode = 1;
      pluginUtils.logError(gutil, badResponseErrMessage);
      callbackOrThrowError(errorCallback, badResponseErrMessage);
      return;
    }

    var responseBody;
    try {
      responseBody = JSON.parse(body);
    } catch (error) {
      process.exitCode = 1;
      pluginUtils.logError(gutil, badResponseErrMessage);
      callbackOrThrowError(errorCallback, badResponseErrMessage);
      return;
    }
    if (!responseBody.version) {
      process.exitCode = 1;
      errorMessage = responseBody['service-response'] ? responseBody['service-response'].message :
        badResponseErrMessage;
      pluginUtils.logError(gutil, errorMessage);
      callbackOrThrowError(errorCallback, errorMessage);
      return;
    }
    var versionResponse = responseBody;
    if (typeof versionResponse !== 'undefined' && 'status' in versionResponse && 'OK' === versionResponse.status ) {
      liaVersion = versionResponse.version;
      return versionResponse;
    }
    process.exitCode = 1;
    pluginUtils.logError(gutil, errorMessage);
    throw new Error(badResponseErrMessage);
  }

  function createVersion(versionStr) {
    var matches = versionStr.toString().match(versionPattern);
    if (!matches || matches.length < 3) {
      process.exitCode = 9;
      throw new Error('Invalid version=' + versionStr + '. Should be of format <major>.<minor> ');
    }

    var serverVersion = {
      supportedVersionMajor: matches[1],
      supportedVersionMinor: matches[2]
    };
    return serverVersion;
  }

  function getVersion() {
    return liaVersion;
  }

  return {
    process: function (server, opts, cb, errorCallback) {
      process(server, opts, cb, errorCallback);
    },
    validate: function (serverUrl, pluginToken, opts, cb, errorCallback) {
      validate(serverUrl, pluginToken, opts, cb, errorCallback);
    },
    createVersion: createVersion,
    liaVersion: liaVersion,
    getVersion: getVersion
  };
};