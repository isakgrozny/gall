#!/usr/bin/env node

'use strict';

var _commander = require('commander');

var _commander2 = _interopRequireDefault(_commander);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fsJetpack = require('fs-jetpack');

var _fsJetpack2 = _interopRequireDefault(_fsJetpack);

require('colors');

var _pug = require('pug');

var _pug2 = _interopRequireDefault(_pug);

var _less = require('less');

var _less2 = _interopRequireDefault(_less);

var _chokidar = require('chokidar');

var _chokidar2 = _interopRequireDefault(_chokidar);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// eslint-disable-next-line no-restricted-imports
_commander2.default.version('0.3.1');

_commander2.default.command('new').option('-f, --force', 'delete existing sources/ directory if any').description('create a new project').action(createNew);

_commander2.default.command('build').description('build the project in the current working directory').action(build);

_commander2.default.command('watch').description('watch for changes in sources/ and queue up a build when it happens').action(watch);

_commander2.default.command('help').description('show usage information').action(function () {
  return _commander2.default.outputHelp();
});

var SCAFFOLD_FILES = ['defines.json', 'style.less', 'template.pug', 'script.js'];

function createNew(options) {
  var scaffoldDir = _path2.default.join(__dirname, '../scaffold');
  var targetDir = _path2.default.join(process.cwd(), '/sources');
  if (_fsJetpack2.default.inspect(targetDir) && !options.force) {
    console.log('Sources directory already exists, aborting. Use --force to override and delete its contents.'.red);
    return;
  }
  console.log('Copying files into scaffold dir...'.green);
  _fsJetpack2.default.dir(targetDir, { empty: true });
  var promises = SCAFFOLD_FILES.map(function (filename) {
    var origin = _path2.default.join(scaffoldDir, filename);
    var target = _path2.default.join(targetDir, filename);
    return _fsJetpack2.default.copyAsync(origin, target).then(function () {
      return console.log('\t', filename.yellow);
    });
  });
  Promise.all(promises).then(function () {
    return console.log('All done!'.green);
  });
}

var REQUIRED_FILES = ['defines.json', 'style.less', 'template.pug', 'script.js', 'story.ink.json'];

function build() {
  var sourceDir = _path2.default.join(process.cwd(), '/sources');
  function sourcePath(filename) {
    return _path2.default.join(sourceDir, filename);
  }
  var filesMissing = REQUIRED_FILES.reduce(function (missing, filename) {
    var filepath = _path2.default.join(sourceDir, filename);
    if (_fsJetpack2.default.inspect(filepath)) {
      return missing;
    }
    missing.push(filename);
    return missing;
  }, []);
  if (filesMissing.length) {
    console.log('Error: Missing required source files'.red);
    filesMissing.forEach(function (filename) {
      console.log('\t', filename.red);
    });
  }
  console.log('Reading source files:'.green);
  var data = {};
  var promises = [];
  var template = void 0;
  promises.push(_fsJetpack2.default.readAsync(sourcePath('style.less')).then(function (text) {
    return _less2.default.render(text);
  }).then(function (output) {
    console.log('\tstyle.less'.yellow);
    data.css = output.css;
  }));

  function bomStrip(text) {
    /*
      Strip a byte-order mark from the head of the file. Inklecate generates
      those for compatibility with some other, mostly Windows-based, tools;
      but since inline JSON is not, technically speaking, a file, we want
      to strip it out before removing it.
    */
    if (text.charCodeAt(0) === 0xFEFF) {
      return text.slice(1);
    }
    return text;
  }

  promises.push(_fsJetpack2.default.readAsync(sourcePath('story.ink.json')).then(function (text) {
    console.log('\tstory.ink.json'.yellow);
    data.story = bomStrip(text);
  }));
  promises.push(_fsJetpack2.default.readAsync(sourcePath('script.js')).then(function (text) {
    console.log('\tscript.js'.yellow);
    data.script = text;
  }));
  promises.push(_fsJetpack2.default.readAsync(sourcePath('template.pug')).then(function (text) {
    console.log('\ttemplate.pug'.yellow);
    template = text;
  }));
  promises.push(_fsJetpack2.default.readAsync(sourcePath('defines.json'), 'json').then(function (json) {
    console.log('\tdefines.json'.yellow);
    data.defines = json;
  }));
  promises.push(_fsJetpack2.default.readAsync(_path2.default.join(__dirname, '../node_modules/ink-blotter/build/blotter.js')).then(function (bundle) {
    console.log('\tblotter.js'.yellow);
    data.blotter = bundle;
  }));
  return Promise.all(promises).then(function () {
    console.log('Writing output file...'.green);
    _fsJetpack2.default.write('out.html', _pug2.default.render(template, data));
  }).catch(function (err) {
    console.error('Error loading game data, ', err);
    throw err;
  });
}

function watch() {
  var sourceDir = _path2.default.join(process.cwd(), '/sources');
  var filesToWatch = REQUIRED_FILES.map(function (filename) {
    return _path2.default.join(sourceDir, filename);
  });
  var watcher = _chokidar2.default.watch(filesToWatch, { persistent: true });
  var lock = false;
  watcher.on('change', function () {
    if (lock) {
      return;
    }
    lock = true;
    console.log(('Files changed on ' + new Date().toLocaleString('en') + '.').yellow);
    console.log('Rebuilding...'.yellow);
    build().then(function () {
      lock = false;
    });
  });
  console.log('Watching sources/ for changes...'.blue);
}

_commander2.default.parse(process.argv);

if (!process.argv.slice(2).length) {
  _commander2.default.outputHelp();
}