#!/usr/bin/env node

var gutil = require('gulp-util');
var path = require('path');
var fs = require('fs');

process.on('uncaughtException', err => {
  console.error('li.js: uncaught error:\n', err);
  process.exit(1);
});

function addSpaces (word, length) {
  word = '  ' + word;
  while (word.length < length + 2) {
    word = word + ' ';
  }
  return word;
}

var cmd = 'help';
if (process.argv.length >= 3) {
	var cmd = process.argv[2];
}

var maxWordLength = 0;
var cmds = fs.readdirSync(path.join(__dirname, 'cmd'))
  .map(function (cm) {
    if (maxWordLength < cm.length) {
      maxWordLength = cm.length;
    }
    return path.basename(cm, '.js');
  });

if (cmds.indexOf(cmd) > -1) {
  process.env.sdk_path = path.join(__dirname, '..');
	require('./cmd/' + cmd).run();
} else {
  if (cmd != 'help') {
    process.exitCode = 9;
    console.log(gutil.colors.red(gutil.colors.bold('Command not found: ' + cmd)));
  }
  console.log(gutil.colors.bold('\nUsage:') + "li command [--options]");
  console.log(gutil.colors.bold('\nValid Commands'));
  var tab = addSpaces('', maxWordLength);
  cmds.forEach(function (cm) {
    var helpObj = require('./cmd/' + cm);
    if (helpObj.help) {
      console.log(gutil.colors.bold(addSpaces(cm, maxWordLength)) +
      helpObj.help.replace(/\n/gm, '\n' + tab));
    }
  });
}
