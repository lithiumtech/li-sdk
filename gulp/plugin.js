'use strict';

var lazyReq = require('lazy-req')(require);
var inquirer = lazyReq('inquirer');
var through = lazyReq('through2');
var path = lazyReq('path');

var PLUGIN_PATHS = {
  SCRIPTS: 'plugin/res/js/angularjs',
  SCRIPT_DEPENDENCIES: 'plugin/res/js/angularjs/metadata',
  TEXT: 'plugin/res/lang/feature'
};

module.exports = function (gulp, gutil) {
  var scripts, text, plugin, pluginUpload, pluginServer, sandboxApi;

  function getPluginServer() {
    if (!pluginServer) {
      pluginServer = require('../lib/plugin-server.js')(gulp, gutil);
    }

    return pluginServer;
  }

  gulp.task('plugin-init', ['clean'], function (cb) {
    scripts = require('../lib/scripts.js')(gulp, gutil);
    text = require('../lib/text.js')(gulp, gutil);
    plugin = require('../lib/plugin-create.js')(gulp, gutil);
    cb();
  });

  gulp.task('plugin-scripts', ['plugin-init'], function () {
    return scripts.process(
      [
        scripts.JS_MAIN_PATTERN,
        scripts.TPL_MAIN_PATTERN,
        scripts.DEPENDENCIES
      ],
      PLUGIN_PATHS.SCRIPTS,
      undefined,
      false,
      true
    );
  });

  gulp.task('plugin-script-deps', ['plugin-scripts'], function () {
    return scripts.createDependencies(
      PLUGIN_PATHS.SCRIPTS,
      PLUGIN_PATHS.SCRIPT_DEPENDENCIES);
  });

  gulp.task('plugin-text', ['plugin-init'], function () {
    var textPropPattern = gutil.env.ng.textProperties.map(function (dir) {
      return path().join(dir, text.FILES_PATTERN);
    });
    return text.process(textPropPattern, PLUGIN_PATHS.TEXT);
  });

  gulp.task('plugin-git-version', ['plugin-init'], function (cb) {
    if (gutil.env.gitStatusVersion) {
      var gitVersion = require('../lib/git-version.js')(gulp, gutil);
      return gitVersion.create('plugin');
    } else {
      cb();
      return gutil.noop();
    }
  });

  gulp.task('plugin-ng', [
    'plugin-script-deps',
    'plugin-text'
  ]);

  gulp.task('plugin-res', gutil.env.ng ? ['plugin-ng'] : ['plugin-init'], function () {
    return gulp.src(['res/**', '!res/**/README.md', '!res/**/*.example'])
      .pipe(gulp.dest('plugin/res'));
  });

  gulp.task('plugin-web', gutil.env.ng ? ['plugin-ng'] : ['plugin-init'], function () {
    return gulp.src(['web/**', '!web/**/README.md', '!web/**/*.example'])
      .pipe(gulp.dest('plugin/web'));
  });

  /* plugin task */
  gulp.task('plugin-build', [
    'plugin-res',
    'plugin-web',
    'plugin-git-version'
  ]);

  gulp.task('plugin-verify', ['plugin-build'], function () {
    return plugin.verify();
  });

  gulp.task('plugin-ready', ['plugin-verify'], function (cb) {
    gutil.log(gutil.colors.green('Done compiling plugin: ' +
      path().join(process.cwd(), '/plugin')));
    cb();
  });

  gulp.task('plugin-upload', ['plugin-ready', 'version-check'], function () {
    var stream = through().obj();
    var server = getPluginServer().getServer();
    if ((gutil.env['force'] || server.force()) && !gutil.env['prompt']) {
      if (!pluginUpload) {
        pluginUpload = require('../lib/plugin-upload.js')(gulp, gutil);
      }
      pluginUpload.upload(server, {
        debugMode: gutil.env['debug']
      }).pipe(stream);
    } else {
      inquirer().prompt({
        name: 'pluginUpload',
        message: 'Would you like to upload plugin to server?',
        type: 'confirm'
      }, function (answers) {
        if (answers.pluginUpload) {
          if (!pluginUpload) {
            pluginUpload = require('../lib/plugin-upload.js')(gulp, gutil);
          }
          pluginUpload.upload(server, {
            debugMode: gutil.env['debug']
          }).pipe(stream);
        } else {
          stream.end();
        }
      });
    }
    return stream;
  });

  gulp.task('plugin', [
    gutil.env['skip-upload'] ?
      'plugin-ready' :
      'plugin-upload'
  ]);

  /** Watch tasks for deleopment **/
  gulp.task('watch-init', ['plugin-ready'], function () {
    sandboxApi = require('../lib/sandbox-api-hack.js')(gulp, gutil);
    return gulp.src(['plugin/**'])
      .pipe(sandboxApi.uploadToSandbox(true));
  });

  function addWatch(pattern, callback, cb) {
    gulp.watch(pattern, function (file) {
      callback(file).pipe(sandboxApi.uploadToSandbox());
    });
    cb();
  }

  gulp.task('watch-scripts', ['plugin-ready'], function (cb) {
    addWatch(
      [scripts.JS_MAIN_PATTERN, scripts.TPL_MAIN_PATTERN],
      function (file) {
        return scripts.process(
          [scripts.JS_MAIN_PATTERN, scripts.TPL_MAIN_PATTERN],
          PLUGIN_PATHS.SCRIPTS,
          [file.path],
          true,
          true
        );
      },
      cb
    );
  });

  gulp.task('watch-script-deps', ['plugin-ready'], function (cb) {
    // TODO: currently goes through all files -
    // try optimizing this for processing updated file only
    addWatch(
      path().join(PLUGIN_PATHS.SCRIPTS, '**/*.js'),
      function () {
        return scripts.createDependencies(
          PLUGIN_PATHS.SCRIPTS,
          PLUGIN_PATHS.SCRIPT_DEPENDENCIES,
          true
        );
      },
      cb
    );
  });

  gulp.task('watch-text', ['watch-init'], function (cb) {
    var textPropPattern = gutil.env.ng.textProperties.map(function (dir) {
      return path().join(dir, text.FILES_PATTERN);
    });
    // TODO: currently goes through all files -
    // try optimizing this for processing updated file only
    addWatch(
      textPropPattern,
      function () {
        return text.process(textPropPattern, PLUGIN_PATHS.TEXT);
      },
      cb
    );
  });

  gulp.task('watch-res', ['watch-init'], function (cb) {
    addWatch(
      ['res/**', '!res/**/README.md', '!res/**/*.example'],
      function (file) {
        return gulp.src(['res/**', '!res/**/README.md', '!res/**/*.example'])
          .pipe(gutil.env.filterFiles([file.path]))
          .pipe(gulp.dest('plugin/res'));
      },
      cb
    );
  });

  gulp.task('watch-web', ['watch-init'], function (cb) {
    addWatch(
      ['web/**', '!web/**/README.md', '!web/**/*.example'],
      function (file) {
        return gulp.src(['web/**', '!web/**/README.md', '!web/**/*.example'])
          .pipe(gutil.env.filterFiles([file.path]))
          .pipe(gulp.dest('plugin/web'));
      },
      cb
    );
  });

  gulp.task('watch-ng', gutil.env.ng ? [
    'watch-scripts',
    'watch-script-deps',
    'watch-text'
  ] : []);

  gulp.task('dev', [
    'watch-ng',
    'watch-res',
    'watch-web'
  ]);

  gulp.task('default', ['dev']);

};
