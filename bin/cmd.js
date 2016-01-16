#!/usr/bin/env node

global['debug'] = true;

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
var rls = require('readline-sync');
var utils = require('./util.js');
// make all functions from util.js global
for (var key in utils)
		global[key] = utils[key];

// parse commandline args
var argv = minimist(process.argv.slice(2), {
  alias: { v: 'verbose', h: 'help', c: 'client', s: 'short', t: 'title', d: 'description', f: 'filter' }
});

// open config
var HOME = process.env.HOME || process.env.USERPROFILE;
var confpath = path.join(HOME, 'settings.json');
var conf;
try { conf = fs.statSync(confpath) } catch (err) { conf = { isFile: function () { return false; } } }
conf = (conf.isFile()) ? fs.readFileSync(confpath, { encoding: 'utf8' }).toString() : "";
conf = (conf.trim() === "") ? {} : JSON.parse(conf);


// create data directory and config
var dbopen = false;
var datadir = process.env.timdata || argv.datadir || conf.datadir || path.join(HOME, '.tim');
var dblogging = console.log;
var dbname = 'db.sqlite';



/**
 *  processes commandline args
 */
function proc(argv) {
  var verb = argv._[0];
	var m = {};
	// initialize m var if verb != init
	if (verb !== "init") {
		debuglog('DB: ' + path.join(datadir, dbname));
		m = require('./model.js')(path.join(datadir, dbname), debug);
	}

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
      if (argv.columns) {
        cols = argv.columns.split(',');
			}
      else {
        cols = ["start", "end", "title", "invoiced", "archived", "clientname", "diffstr"];
			}

      cols.unshift(rows);
      asTable.apply(this, cols);
      //asTable(rows, cols);
    });
  }

  // #### STAGE ###
  // stages tracked times or invoice positions
  else if (verb === 'stage') {
    var what = argv._[1]; // stage what?
		if (what === "times") {
			var client = argv.c || argv.s;
			var filter = [
				["invoiced", 0],
				["archived", 0],
				["end not null"]
			];
			if (argv.c) {
				filter.push(["clientName", argv.c]);
			}
			else {
				filter.push(["shortKey", argv.s]);
			}

			m.Time.list(filter, function(err, rows) {
				if (err)
					throw err;

				// show start and end times in a more readable way
				rows.map(function (r) {
					r.start = moment(r.start).format("llll");
					r.end = moment(r.end).format("llll");
				});

				// print table
				var cols = ["id","start", "end", "title", "clientname", "diffstr"];
				cols.unshift(rows);
				asTable.apply(this, cols);

				console.log(""); // empty line after table

				// ask for time-IDs to put into an invoice position
				var answer = rls.question("Select 'all' or a comma separated list of time-IDs: ");
				var ids = [];
				var times = [];
				var quantity = 0;
				var hourlyWage = conf.hourlyDefaultWage;
				if (answer === "all") {
					rows.forEach(function (item) {
						ids.push(item.id);
					});
					times = rows;
				}
				else {
					ids = answer.split(",");
					ids = ids.map(Number);
					rows.forEach(function (item) {
						if (ids.indexOf(item.id)>=0) {
							times.push(item);
							quantity += item.diff.asHours();
						}
					});
				}

				// ask for other stuff
				var title = rls.question("Title for this position: ");
				var description = rls.question("Description for this position (optional): ");
				var value = rls.question("Value per hour (" + hourlyWage + "): ") | hourlyWage;
				var quantity = rls.question("Quantity (" + Math.ceil(quantity) + "): ") | Math.ceil(quantity);

				console.log("Choices:\n"+title+"\n"+description+"\n"+value+"\n"+quantity);
			});
		}
		else if (what === "pos") {

		}
		else {
			usage('stage', true);
		}
  }

  // #### HELP ####
  // output help for parameter
  else if (verb === 'help') {
    usage(argv._[1], false);
  }

  // ##### TEST ####
  // for testing stuff
  else if (verb === 'invoicetest') {
    var inv = require('./invoice.js')("./tpl/invoice.ejs");
    var cli = { "name": "Kunde", "street1": "Kundenstraße 15", "street2": "Apartment 1a", "zip": 55411, "city": "Bingen" };
    var pos = [{ "title": "Programmierung", "quantity": 5, "value": 20, "description": "code tests" }, { "title": "Programmierung", "quantity": 5, "value": 20, "description": "code tests" }];
    inv.create(cli, pos, 10, new Date());
  }
	else if (verb === 'test') {
		utils.debuglog('util test');
	}


  else if (verb === 'init') {
		if (argv.datadir || process.env.timdata) {
			datadir = argv.datadir || process.env.timdata;
		}
		mkdirp.sync(datadir);
		var m = require('./model.js')(path.join(datadir, dbname), debug);
    m.initDb();
		conf.datadir = datadir;
		conf.hourlyDefaultWage = rls.question("What will be your default hourly wage? ");
		saveConfig();
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
  usage['start'][0] = "\ttim start ((-c|--client ClientName)|(-s|--short ShortKey)) -t|--title Title [--description Description] [--start StartTime]";

  usage['status'] = new Array();
  usage['status'][0] = "\ttim status";

  usage['stop'] = new Array();
  usage['stop'][0] = "\ttim stop [--end EndTime]";

	usage['list'] = new Array();
	usage['list'][0] = "\ttim list [filters]";

	usage['stage'] = new Array();
	usage['stage'].push("\ttim stage - Combines tracked times into an invoice position");
	usage['stage'].push("\ttim stage times|pos (-c|--client clientName)|(-s|--short shortKey)");

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
  var objectArray = arguments[0];
  var keyList = Array.prototype.slice.call(arguments, 1);

  var keys = [];       // contains all key names of objects stored in objectArray
  var keydict = [];
  var maxlength = []; // max length for every column
  var formats = [];

  // validate arguments: obj
  if (!objectArray) {
    throw {"name": "ArgumentInvalidEx", "msg": "You must supply at least one object to print as table"};
  }

  // pack obj into an array if it isn't in one
  if (objectArray.constructor !== Array) {
    objectArray = [obj,];
  }

  // validate arguments: keys
  if (!keyList || keyList.length === 0 || (keyList.length === 1 && keyList[0] === "*")) {
    for (var key in objectArray[0]) {
      if (typeof key !== 'function') keyList.push(key);
    }
  }

  // create keys array and keydict to save key aliases for the table
  // also initializes maxlength[key] with the length of the keyname which will be used as header
  keyList.forEach(function(key) {
    if (key.constructor === Array) {
      keys.push(key[0]);
      keydict[key[0]] = key[1];
      maxlength[key] = String(key[1]).length;
    }
    else {
      keys.push(key);
      maxlength[key] = String(key).length;
    }
  });

  // find max length of content for each key
  objectArray.forEach(function (obj) {
    keys.forEach(function (key) {
      if (String(obj[key]).length > maxlength[key]) {
        maxlength[key] = String(obj[key]).length;
      }
    });
  });

  // print header
  var line = "";
  var headerLabels = [];
  keys.forEach(function(key) {
    line += "%-" + maxlength[key] + "s|";   // insert max length of key/value for obj key
    headerLabels.push((keydict[key]) ? keydict[key] : key);   // save headers in array
  });
  line = line.substring(0,line.length-1); // remove last "|", line done here

  var ar = headerLabels;
  ar.unshift(line);               // put the format string in front of args array
  console.log(printf.apply(this, ar)); // print headers
  // print content
  objectArray.map(function (obj) { // loop objects
    var objvalues = [];
    keys.forEach(function (key) {
      objvalues.push(obj[key]); // push object values into array for each key
    });

    objvalues.unshift(line);
    console.log(printf.apply(this, objvalues));
  });
}

proc(argv);
