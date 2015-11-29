#!/usr/bin/env node

var debug = true;

// include packages
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var minimist = require('minimist');
var moment = require('moment');
require('moment-duration-format');
var sqlite = require('sqlite3');
var os = require('os');
var tmpdir = (os.tmpdir || os.tmpDir)();
var printf = require('sprintf-js').sprintf;
var readline = require('readline');

// parse commandline args
var argv = minimist(process.argv.slice(2), {
  alias: { v: 'verbose', h: 'help', c: 'client', s: 'short', t: 'title', d: 'description', f: 'filter' }
});

// create data directory and config
var dbopen = false;
var HOME = process.env.HOME || process.env.USERPROFILE;
var datadir = argv.datadir || path.join(HOME, '.tim');
mkdirp.sync(datadir);
var confpath = path.join(datadir, 'settings.json');
var conf;
try { conf = fs.statSync(confpath) } catch (err) { conf = { isFile: function () { return false; } } }
conf = (conf.isFile()) ? fs.readFileSync(confpath, { encoding: 'utf8' }).toString() : "";
conf = (conf.trim() === "") ? {} : JSON.parse(conf);

//TODO: make this setting accessable for the user in order to let him save it in dropbox or so
var dblogging = console.log;
var dbname = (process.env.DEV) ? 'db.dev.sqlite' : 'db.sqlite';
debuglog("dbname: " + dbname);
var m = require('./model.js')(path.join(datadir, dbname), debug);


/**
 *  processes commandline args
 */
function proc(argv) {


  var verb = argv._[0];
  if (argv.h) {
    usage(0);
  }

  // ##### SEARCH #####
  // search something on the database
  // for now you can only search clients
  else if (verb === 'search') {
    var target = argv._[1];
    if (target === 'help')
      return usage('search', false);
    // search clients
    if (target === 'client' || !target) {
      var spattern = "";
      var stype = "";
      if (argv.c || argv.name) {
        spattern = (argv.c) ? argv.c : argv.name;
        stype = "name";
      }
      else if (argv.s) {
        spattern = argv.s;
        stype = "short";
      }
      else {
        //console.log("Please specify a client name with -c|--client or a short key with -s|--short!");
        return usage('search', true);
      }

      getClient(spattern, stype, function (err, clients) {
        if (err) {
          console.log(err);
          process.exit(-1);
        }
        if (typeof clients == 'undefined' || ! clients) {
          console.log('No clients with that name or short-code found!\n');
          return 0;
        }

        console.log(printf("%-5s | %-15s | %-20s | %-6s | %-20s | %-10s", "ID", "Name", "Street 1", "Zip", "City", "Shortkey"));
        clients.forEach(function(client) {
          console.log(printf("%-5s | %-15s | %-20s | %-6s | %-20s | %-10s", client.id, client.name, stripNull(client.street1), stripNull(client.zip), stripNull(client.city), stripNull(client.short)));
        });
      });
    }
    else {
      return usage('search', true);
    }
  }

  // ##### ADD #####
  // add a client to the database
  else if (verb === 'add') {
    var type = argv._[1];
    if (type === 'client') {
      if (typeof argv.name === 'undefined' || argv.name.trim() === "") {
        console.log("Please supply at least a name for the new customer!");
        process.exit(-1);
      }
      m.Client.create({
        $name: argv.name,
        $street1: argv.street1 || "",
        $zip: argv.zip+"" || "",
        $city: argv.city || "",
        $street2: argv.street2 || "",
        $short: argv.short || null
      });
    }
    else {
      usage('add', true);
    }
  }

  // ###### START ####
  // start time measurement
  else if (verb === 'start') {
    var spattern = "";
    var stype = "";

    // get search type for client
    if (argv.c) {
      spattern = argv.c;
      stype = "name";
    }
    else if (argv.s) {
      spattern = argv.s;
      stype = "short";
    }
    else {
      console.log("Please specify a client name with -c|--client or a short key with -s|--short!");
      return;
    }

    getClient(spattern, stype, function(err, clients) {
      if (err) {
        console.log(err);
        process.exist(-1);
      }

      if (typeof clients === 'undefined' || clients === null) {
        console.log("No clients with that search pattern found!");
        process.exit(-1);
      }

      if (clients.length > 1) {
        //TODO: ask which client to use
        console.log("there's more than one client in the result set!");
        process.exit(-1);
      }
      else {
        timeTrack(clients, argv.t, argv.d, argv.start);
      }
    });
  }

  // ##### STATUS ####
  // print status of time measurement
  else if (verb === 'status') {
    m.Time.status(function (err, data) {
      if (err)
        console.log("There was an error while querying for actual status: " + err);

      // output status information if there's an open time track
      if (data) {
        // found a record, telling the user about the status
        console.log(printf("Time tracking started!\n\t%-15s %s\n\t%-15s %s\n\t%-15s %s\n\t%-15s %s\n\t%-15s %s",
                           "Client:",
                           data.row.clientname,
                           "Title:",
                           data.row.title,
                           "Description:",
                           data.row.description,
                           "Since:",
                           moment(data.row.start).format('llll'),
                           "Duration:",
                           data.diff.format('H [h] m [min] s [sec]')));
      }
      else {
        console.log("No time tracking running!");
      }
    });
  }

  // ##### STOP ####
  // stop time tracking
  else if (verb === 'stop') {
    var end = (argv.end) ? new Date(argv.end) : new Date();

    m.Time.stop(end, function(err) {
      if (err)
        console.log("There was an error ending the timetracking:\n" + err);
    });
  }

  // #### LIST ####
  // list tracked times
  else if (verb === 'list') {
    var filts = null;
    if (argv.f) {
      var filts = JSON.parse(argv.f);
    }

    m.Time.list(filts, function(err, rows) {
      if (err)
        throw err;

      rows.map(function (r) {
        r.start = moment(r.start).format("llll");
        r.end = moment(r.end).format("llll");
      });

      var cols = [];
      if (argv.columns)
        cols = argv.columns.split(',');
      else
        cols = ["start", "end", "title", "invoiced", "archived", "clientname", "diffstr"];

      cols.unshift(rows);
      asTable.apply(this, cols);
      //asTable(rows, cols);
    });
  }

  // #### STAGE ###
  // stages tracked times or invoice positions
  else if (verb === 'stage') {
    //TODO
  }

  // #### HELP ####
  // output help for parameter
  else if (verb === 'help') {
    usage(argv._[1], false);
  }

  // ##### TEST ####
  // for testing stuff
  else if (verb === 'test') {
    var inv = require('./invoice.js')("./tpl/invoice.ejs");
    var cli = { "name": "Kunde", "street1": "Kundenstraße 15", "street2": "Apartment 1a", "zip": 55411, "city": "Bingen" };
    var pos = [{ "title": "Programmierung", "quantity": 5, "value": 20, "description": "code tests" }, { "title": "Programmierung", "quantity": 5, "value": 20, "description": "code tests" }];
    inv.create(cli, pos, 10, new Date());
  }


  else if (verb === 'init') {
    m.initDb();
  }

  else {
    usage(null, true);
  }
}

/**
 * starts timetracking for a specific client.
 * mandatory parameters:
 * - client
 * - title
 */
function timeTrack(client, title, description, date, action) {
  action = typeof action === 'undefined' ? "start" : action;
  if (typeof client === 'undefined' || client === null)
    throw "Please specify a client to track the time for!";
  if (typeof title === 'undefined' || title === null)
    throw "You need to specify a title!";
  description = typeof description !== 'undefined' ? description : null;

  // parse date here
  date = typeof date !== 'undefined' ? new Date(date) : new Date();
  if (!(date instanceof Date || date.toString() === "Invalid Date"))
    throw "This is not a valid Date";

  //debuglog('\nClient object:\n', JSON.stringify(client, null, 2));
  if (action === 'start') {
    m.Time.start(client, title, description, date, function (err) {
      if (err)
        throw err;
      else
        console.log("insert successful!");
    });
  }
  else if (action === 'stop') {
    //TODO implement
  }
}

/**
 * gets clients based on search-pattern (spattern) and search-type (stype)
 * and passes the results to callback
 */
function getClient(spattern, stype, callback) {
  // search for client name
  if (stype==='name') {
    debuglog("searching client by name: " + spattern);
    m.Client.findByName({ $name: spattern	}, callback)
  }
  // search for short code
  else if (stype==='short') {
    debuglog("searching client by shortkey:" + spattern);
    m.Client.findByKey({ $short: spattern }, callback);
  }
  else {
    console.log("Not a valid search option: " + stype);
    process.exit(-1);
  }
}

/**
 * saves the configuration
 */
function saveConfig() {
  fs.writeFileSync(confpath, JSON.stringify(conf), { encoding: 'utf8' }, function (err) {
    if (err) throw err;
    console.log('Config saved!');
  });
}

/**
 * prints usage information for tim
 */
function usage(arg, invalid) {
  // parse arguments
  invalid = typeof invalid === 'undefined' ? false : invalid;
  if (invalid) console.log("Invalid command!");

  // define usage strings
  var usage = new Array();

  // help for search keyword
  usage['search'] = new Array();
  usage['search'][0] = "\ttim search [client] (-c|--client pattern)|(-s|--short key)";

  // help for add keyword
  usage['add'] = new Array();
  usage['add'][0] = "\ttim add client -c|--client ClientName [--street1 value] [--street2 value] [--zip zip] [--city city] [--short shortkey]";

  // start keyword
  usage['start'] = new Array();
  usage['start'][0] = "\ttim start ((-c|--client ClientName)|(-s|--short ShortKey)) -t|--title Title [--description] [--start StartTime]";

  usage['status'] = new Array();
  usage['status'][0] = "\ttim status";

  usage['stop'] = new Array();
  usage['stop'][0] = "\ttim stop [--end EndTime]";

  // output usage / help
  console.log("Usage - incomplete but please go ahead and read what's already there:\n");
  if (arg && usage[arg] != undefined) {
    console.log("Usage for tim " + arg + ":");
    usage[arg].forEach(function (val) {
      console.log(val);
    });
  }
  else {
    for (var usg in usage) {
      usage[usg].forEach(function (val) {
        console.log(val);
      });
    }
  }

  process.exit(invalid ? -1 : 0);
}

function asTable() {
  // arguments:
  var obj = arguments[0];
  var keyList = Array.prototype.slice.call(arguments, 1);

  var keys = [];
  var keydict = [];
  var maxlength = []; // max length for every column
  var formats = [];

  // validate arguments: obj
  if (!obj)
    throw {"name": "ArgumentInvalidEx", "msg": "You must supply at least one object to print as table"};
  // pack obj into an array if it isn't in one
  if (obj.constructor !== Array)
    obj = [obj,];
  // validate arguments: keys
  if (!keyList || keyList.length === 0)
    for (var k in obj[0])
      if (typeof k !== 'function') keyList.push(k);
  // create keys array and keydict to save key aliases for the table
  keyList.map(function(k) {
    if (k.constructor === Array) {
      keys.push(k[0]);
      keydict[k[0]] = k[1];
      maxlength[k] = ((k[0]+"").length > (k[1]+"").length) ? (k[0]+"").length : (k[1]+"").length; // (k[x]+"") -> implicit string conversion
    }
    else {
      keys.push(k);
      maxlength[k] = (k+"").length;
    }
  });

  // find max length of content for each key
  obj.map(function (o) {
    keys.map(function (p) {
      maxlength[p] = (maxlength[p] >= (o[p]+"").length) ? maxlength[p] : (o[p]+"").length;
    });
  });

  // print header
  var line = "";
  var headerlbls = [];
  keys.map(function(h) {
    line += "%-" + maxlength[h] + "s|";
    headerlbls.push((keydict[h]) ? keydict[h] : h);
  });
  line = line.substring(0,line.length-1); // line variable ready here
  var ar = headerlbls;
  ar.unshift(line);
  console.log(printf.apply(this, ar));
  // print content
  obj.map(function (o) { // loop objects
    var objvalues = [];
    keys.map(function (k) {
      objvalues.push(o[k]);
    });

    objvalues.unshift(line);
    console.log(printf.apply(this, objvalues));
  });
}

function debuglog(str) {
  if (debug)
    console.log("[DEBUG] " + str);
}

function stripNull(str) {
  if (typeof str === 'undefined' || str === null)
    return "";
  else
    return str;
}

proc(argv);
