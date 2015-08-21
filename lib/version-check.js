'use strict';

var request = require('request');
var pluginUtils = require('../lib/plugin-utils');
var supportedMinVersion = 15.7;
var sdkVersion = '0.0.5';
var parser = require('xml2json');

module.exports = function (gulp, gutil) {

    function validate(serverUrl, pluginToken, cb) {

        var options = {
            headers: {
                Authorization: 'Bearer ' + pluginToken
            }
        };

        var versionCheckUrl = pluginUtils.urlBldr(serverUrl + '/restapi/ldntool/plugins/version').build();
        request(versionCheckUrl, options, function (error, response, body) {
            if (error || response.statusCode > 201) {
                parseResponse(cb, body);
                return;
            }
            try {
                var versionResponse = parseResponse(cb, body);
                var version = versionResponse.version;
                var matches = version.toString().match(/(\d+(\.\d)*)/i);
                if (!matches || matches.length < 1) {
                    callbackOrThrowError(cb, 'Invalid version check response ' + version);
                    return;
                }
                var versionOnServer = matches[1];
                if (versionOnServer < supportedMinVersion) {
                    var errorMessage = 'Supported minimum version on server is ' + supportedMinVersion + '.';
                    errorMessage += ' Either contact support to get your stage server upgraded to version '
                        + supportedMinVersion + ' or else downgrade your version of the sdk (Run npm install@' + sdkVersion+')';
                    callbackOrThrowError(cb, errorMessage);
                }
            } catch (error) {
                callbackOrThrowError(cb, error.message);
            }
        });
    }

    function process(server, cb) {
        if (server.serverUrl() === undefined) {
            var errMessage = 'A server URL is required in your configuration. ';
            callbackOrThrowError(cb, errMessage);
        }
        validate(server.serverUrl(), server.pluginToken(), cb);
    }

    function callbackOrThrowError(cb, errorMsg) {
        if (typeof cb !== 'undefined') {
            cb(new Error(errorMsg), null);
        } else {
            var error = new Error(errorMsg);
            Error.captureStackTrace(error, callbackOrThrowError);
            throw error;
        }
    }

    function parseResponse(cb, body) {
        var errorMessage = 'Empty version check response';
        if ( !body ) {
            pluginUtils.logError(gutil, errorMessage);
            callbackOrThrowError(cb, errorMessage);
            return;
        }
        var responseBody = JSON.parse(parser.toJson(body));
        if (!responseBody['version-response']) {
            errorMessage = responseBody['service-response'] ? responseBody['service-response'].message :
                'Invalid response from server';
            pluginUtils.logError(gutil, errorMessage);
            callbackOrThrowError(cb, errorMessage);
        }
        var versionResponse = responseBody['version-response'];
        if ('status' in versionResponse && 'OK' === versionResponse.status ) {
            return versionResponse;
        }
        if ( !('version' in versionResponse) || !versionResponse.version.toString().trim()) {
            pluginUtils.logError(gutil, errorMessage);
            throw new Error(errorMessage);
        }
        throw new Error(versionResponse);
    }

    return {
        process: function (server, cb) {
            process(server, cb);
        },
        validate: function (serverUrl, pluginToken, cb) {
            validate(serverUrl, pluginToken, cb);
        }
    };
}