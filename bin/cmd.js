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
	alias: { v: 'verbose', h: 'help', c: 'client', s: 'short', t: 'title', d: 'description', f: 'filter', street: 'street1' }
});

// open config
var HOME = process.env.HOME || process.env.USERPROFILE;
HOME = path.join(HOME, ".tim/");
var confpath = path.join(HOME, 'settings.json');
var conf = false;
try { conf = fs.statSync(confpath) } catch (err) { }
conf = (conf.isFile()) ? fs.readFileSync(confpath, { encoding: 'utf8' }).toString() : "";
conf = (conf.trim() === "") ? {} : JSON.parse(conf);


// create data directory and config
var dbopen = false;
var datadir = process.env.timdata || argv.datadir || conf.datadir || HOME;
var dblogging = console.log;
var dbname = 'db.sqlite';
var model = require('./model.js')(path.join(datadir, dbname)); // model variable


/**
 *  processes commandline args
 */
function proc(model, argv) {
	var verb = argv._[0];
	//m = require('./model.js')(path.join(datadir, dbname));

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
			var search = {};
      if (argv.c || argv.name) {
				search.name = argv.c || argv.name;
      }
      else if (argv.s) {
				search.short = argv.s
      }
      else {
        //console.log("Please specify a client name with -c|--client or a short key with -s|--short!");
        return usage('search', true);
      }

      getClient(search, function (err, clients) {
        if (err) {
          console.log(err);
          process.exit(-1);
        }
        if (!clients || (clients.constructor === Array && clients.length === 0)) {
          console.log('No clients with that name or short-code found!\n');
          process.exit(-1);
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
      model.Client.create({
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
		var search = {};

		if (argv.c) {
			search.name = argv.c;
		}
		else if (argv.s) {
			search.short = argv.s;
		}
		else {
      console.log("Please specify a client name with -c|--client or a short key with -s|--short!");
      return;
    }


		getClient(search, function(err, clients) {
			if (err) {
				console.log(err);
				process.exit(-1);
			}

			if (!clients || (clients.constructor === Array && clients.length === 0)) {
				console.log('No clients with that name or short-code found!\n');
				process.exit(-1);
			}

			if (clients.length > 1) {
				selectFromList(clients, null, function(err, result) {
					if (err) {
						console.log("Error selecting a client:\n" + err);
						process.exit(-1);
					}

					clients = result;
				});
			}

			debuglog("Selected client:\n" + JSON.stringify(clients, null, 2));

      startTimeTracking(clients, argv.t, argv.d, argv.start);
    });
  }
  // ##### STATUS ####
  // print status of time measurement
  else if (verb === 'status') {
    model.Time.status(function (err, data) {
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
                           data.diffstr));
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

    model.Time.stop(end, function(err) {
      if (err)
        console.log("There was an error ending the timetracking:\n" + err);
    });
  }

  // #### LIST ####
  // list tracked times
  else if (verb === 'list') {
    var filts = null;
    if (argv.f) {
      filts = JSON.parse(argv.f);
    }
		else {
			filts = [
				["archived", 0],
				["fk_InvoicePos is null"]
			];
		}

    model.Time.list(filts, function(err, rows) {
      if (err)
        throw err;

      rows.map(function (r) {
        r.start = moment(r.start).format("llll");
				if (r.end !== '- running -') {
					r.end = moment(r.end).format("llll");
				}
      });

      var cols = [];
      if (argv.columns) {
        cols = argv.columns.split(',');
			}
      else {
        cols = ["start", "end", "title", ["fk_InvoicePos", "invoice pos"], "archived", "clientname", "diffstr"];
			}

      cols.unshift(rows);
      asTable.apply(this, cols);
    });
  }

  // #### STAGE ###
  // stages tracked times or invoice positions
  else if (verb === 'stage') {
    var what = argv._[1]; // stage what?
		if (what === "times") {
			var client = argv.c || argv.s;
			var filter = [
				["fk_InvoicePos is null"],
				["archived", 0],
				["end not null"]
			];
			if (argv.c) {
				filter.push(["clientName", argv.c]);
			}
			else {
				filter.push(["shortKey", argv.s]);
			}

			model.Time.list(filter, function(err, rows) {
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
						}
					});
				}

				// calculate totals
				rows.forEach(function (row) {
					if (ids.indexOf(row.id)>=0) {
						quantity += row.diff.asHours();
					}
				});

				// ask for other stuff
				var title = rls.question("Title for this position: ");
				var description = rls.question("Description for this position (optional): ");
				var value = rls.question("Value per hour (" + hourlyWage + "): ") | hourlyWage;
				var quantity = rls.question("Quantity (" + Math.ceil(quantity) + "): ") | Math.ceil(quantity);

				// save changes!
				model.InvoicePos.create(ids, quantity, value, title, description);
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
		debuglog('util test');
	}


  else if (verb === 'init') {
		if (process.env.timdata || argv.datadir) {
			datadir = process.env.timdata || argv.datadir;
		}
		mkdirp.sync(datadir);
		var model = require('./model.js')(path.join(datadir, dbname), debug);
    model.initDb();
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
function startTimeTracking(client, title, description, date) {
  if (!client)
    throw "Please specify a client to track the time for!";
  if (!title)
    throw "You need to specify a title!";
  description = description || null;

  // parse date here
  date = (!date) ? new Date(date) : new Date();
  if (!(date instanceof Date || date.toString() === "Invalid Date"))
    throw "This is not a valid Date";

	model.Time.start(client, title, description, date, function (err) {
		if (err)
			throw err;
		else
			console.log("Time tracking started for ", client.name, "!");
	});
}

/**
 * gets clients based on search-pattern (spattern) and search-type (stype)
 * and passes the results to callback
 */
function getClient(search, callback) {
	// search client by name
	if (search.name) {
    debuglog("Searching client by name: " + search.name);
    model.Client.findByName({ $name: search.name	}, callback)
  }
  // search for short key
  else if (search.short) {
    debuglog("Searching client by shortkey:" + search.short);
    model.Client.findByKey({ $short: search.short}, callback);
  }
  else {
		callback("No client search argument given!");
  }
}

/**
 * saves the configuration
 */
function saveConfig() {
	console.log("Saving config to " + confpath);
  fs.writeFileSync(confpath, JSON.stringify(conf, null, 2), { encoding: 'utf8' }, function (err) {
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


proc(model, argv);
