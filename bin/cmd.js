#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var minimist = require('minimist');
var Seq = require('sequelize'); // db package
var nconf = require('nconf'); // for read/write conf file
var strftime = require('strftime');
var stringify = require('json-stable-stringify');
var os = require('os');
var tmpdir = (os.tmpdir || os.tmpDir)();

var argv = minimist(process.argv.slice(2), {
alias: { v: 'verbose', h: 'help' }
});

// create data directory
var HOME = process.env.HOME || process.env.USERPROFILE;
var datadir = argv.d || path.join(HOME, '.clocker');
mkdirp.sync(datadir);

// open config file
nconf.use('file', { file: (path.join(datadir, 'settings.json')) });
nconf.load();

//TODO: make this setting accessable for the user in order to let him save it in dropbox or so
var db = new Seq('main', null, null, { host: 'localhost', dialect: 'sqlite', storage: path.join(datadir, 'db.sqlite') });

// check if db is already initialized and do so if not
if (! nconf.get('init')) {
  console.log('DB not initialized! Initializing now...');
  var models = [
    'Client',
    'Invoice',
    'TrackedTime'
  ];

  models.forEach(function(model) {
    module.exports[model] = db.import(path.join(__dirname, 'model');
  });
  
  //TODO: specify relations
  //INFO: http://www.redotheweb.com/2013/02/20/sequelize-the-javascript-orm-in-practice.html

  //TODO: initialize DB if not done already
}

// process user commands
if (argv.h) {
  usage(0)
}
else if (argv._[0] === 'start') {
  var d = argv.date ? new Date(argv.date) : new Date;
  //TODO: start!
}

function saveConfig() {
  nconf.save(function (err) {
      if (err) {
      console.error(err.message);
      return;
      }
      console.log('Configuration saved successfully.');
      });
}
