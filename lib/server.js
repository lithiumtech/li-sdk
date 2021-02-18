/**
 * Library methods for server tasks
 *
 * @author Nikhil Modak
 */

'use strict';

var path = require('path');

module.exports = function (gulp, gutil) {

  var serverConfig = {};
  var serverConfigPath = gutil.env.serverConfig || 'server.conf.json';

  var defaults = {
    serverUrl: undefined,
    pluginToken: undefined,
    community: undefined,
    strictMode: false,
    dryRun: false,
    allowStudioOverrides: false,
    toolVersion: '1.0.0',
    verbose: false,
    force: false,
    pluginPoints: [],
    sdkOutputDir: undefined,
    coreOutputDir: 'coreplugin',
    configDir: 'configs',
    useLocalCompile: false,
    localSkinCompileVersion: 'v2-lia16.6',
    localSkinCompileSkin: 'responsive_peak',
    localSkinCompileFeature: 'responsivepeak',
    localSkinCompileDest: '.tmp/lia/styles',
    localServerDir: '.tmp/lia',
    localServerPort: 9000,
    useResponsiveConfigsFromServer: false,
    skipTemplateValidation: false,
    //Hack to copy files to plugin - until sandbox is fully supported.
    sandboxPluginDir: undefined,
    pluginReloadUrl: '/t5/api/plugin'
  };

  try {
    serverConfig = gutil.env.useServerDefaults ? {} : require(path.join(process.cwd(), serverConfigPath));
  } catch (err) {
    process.exitCode = 1;
    throw new Error('Error reading server.conf.json at [' +
      path.join(process.cwd(), serverConfigPath) +
      ']. Please use template.server.conf.json to create server.conf.json.');
  }

  Object.keys(defaults).forEach(function (key) {
    if (!serverConfig.hasOwnProperty(key) || serverConfig[key] === undefined) {
      serverConfig[key] = defaults[key];
    }
  });

  var serverApi = {};

  Object.keys(serverConfig).forEach(function (key) {
    serverApi[key] = function () {
      return serverConfig[key];
    };
  });

  serverApi.pluginUploadProtocol = function() {
    var serverUrl = serverApi.serverUrl();
    if (serverUrl && serverUrl.indexOf('http://') > -1) {
      return 'http';
    }

    return 'https';
  };

  return serverApi;
};
