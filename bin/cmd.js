#!/usr/bin/env node

// include packages
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var minimist = require('minimist');
var sqlite = require('sqlite3');
var Seq = require('sequelize'); // db package
var nconf = require('nconf'); // for read/write conf file
var strftime = require('strftime');
var stringify = require('json-stable-stringify');
var os = require('os');
var tmpdir = (os.tmpdir || os.tmpDir)();

// db model vars
var Client = null, Invoice = null, TrackedTime = null;

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
var db = new Seq('main', null, null, { host: 'localhost', dialect: 'sqlite', storage: path.join(datadir, 'db.sqlite'), logging: false });

// check if db is already initialized and do so if not
if (! nconf.get('init')) {
  console.log('DB not initialized! Initializing now...');

  // ########## model definition here! #####
  var Client = db.define('Client', {
    name: Seq.STRING,
    street1: Seq.STRING,
    street2: Seq.STRING,
    zip: Seq.STRING(7),
    city: Seq.STRING
  });

  var Invoice = db.define('Invoice', {
    date: Seq.DATE
  });

  // set relations
  Invoice.hasMany(Client);

  var TrackedTime = db.define('TrackedTime', {
    start: Seq.DATE,
    end: Seq.DATE,
    title: Seq.STRING,
    description: Seq.TEXT
  });

  // set relations
  TrackedTime.hasMany(Client);

  // ########## model definition end!  #####

  //TODO: specify relations
  //INFO: http://www.redotheweb.com/2013/02/20/sequelize-the-javascript-orm-in-practice.html

  //TODO: initialize DB if not done already

  // save changes to db:
  db.sync();
}

console.log('saving some clients now...');
// Client.create({
//   name: "Max Mustermann",
//   street1: "Somestreet 123",
//   zip: "12345",
//   city: "Musterstadt"
// })
// Client.create({
//   name: "Ulla Musterfrau",
//   street1: "Sesamstraße 123",
//   zip: "12345",
//   city: "Musterstadt"
// });
Client.destroy({where: {id: {$gt: 2}}});
console.log('saved client data!\n');

Client.findAll().then(function (clients) {
  if (typeof clients == 'undefined' || ! clients) {
    console.log('error fetching clients!\n');
    return -1;
  }
  clients.forEach(function(client) {
    console.log('found client: ' + client.name);
    console.log('address: ' + client.street1 + " - " + client.zip + " " + client.city);
    console.log('---------------------------------');
  });
});

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

function usage(arg) {
  console.log("TODO!");
}
