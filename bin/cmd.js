#!/usr/bin/env node


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

global['debug'] = !(!argv.v);

// open config
var HOME = process.env.HOME || process.env.USERPROFILE;
HOME = path.join(HOME, ".tim/");
var confpath = path.join(HOME, 'settings.json');
var conf = false;
try { conf = fs.statSync(confpath) } catch (err) { }
conf = (conf && conf.isFile()) ? fs.readFileSync(confpath, { encoding: 'utf8' }).toString() : "";
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

				var headers = [
					{ name: "id", alias: "ID" },
					{ name: "name", alias: "Name" },
					{ name: "street1", alias: "Street" },
					{ name: "zip", alias: "ZIP" },
					{ name: "city", alias: "City" },
					{ name: "email", alias: "E-Mail" },
					{ name: "short", alias: "Shortkey" }
				];
				clients = stripNullsFromObjects(clients);
				asTable({ rows: clients, keyList: headers });
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
        $zip: (argv.zip) ? argv.zip+"" : "",
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

			if (clients.constructor === Array && clients.length === 1)
				clients = clients[0];

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
		var what = argv._[1];
		// list times
		if (!what || what === "times") {
			var filts = null;
			if (argv.f) {
				filts = JSON.parse(argv.f);
        if (!argv.override-filter) {
          filts.push(["archived", 0]);
          filts.push(["fk_InvoicePos is null"]);
        }
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

				var headers = [
					 { name: "start", alias: "Start" },
					 { name: "end", alias: "End" },
					 { name: "title", alias: "Title" },
					 { name: "clientname", alias: "Client name" },
					 { name: "fk_InvoicePos", alias: "Invoice Position" },
					 { name: "archived", alias: "Archived" },
					 { name: "diffstr", alias: "Time taken", align: "right" }
				];

				var cols = [];
				if (argv.columns) {
					cols = argv.columns.split(',');
				}
				else if (argv.archived) {
					cols = ["start", "end", "title", "fk_InvoicePos", "archived", "clientname", "diffstr"];
				}
				else {
					cols = ["start", "end", "title", "clientname", "diffstr"];
				}
				headers = headers.filter(function (item) {
					return (cols.indexOf(item.name) > -1) || (cols.indexOf(item.alias) > -1);
				});

				asTable({rows: rows, keyList: headers});
			});
		}
		// list InvoicePos
		else if (what === "pos" || what === "invoice" || what === "inv") {
			var clientSearch = {};
			if (argv.c) {
				clientSearch.name = argv.c;
			}
			else if (argv.s) {
				clientSearch.short = argv.s;
			}
			else {
				console.log("You need to specify a client with -c|--client or -s|--short");
				process.exit(-1);
			}

			getClient(clientSearch, function (err, clients) {
				if (err) {
					console.log("There was an error retreiving the client:", err);
					process.exit(-1);
				}

				// check number of clients found and ask user if there's more than one
				var id;
				if (clients.constructor === Array) {
					if (clients.length === 1) {
						id = clients[0].id;
					}
					else if (clients.length === 0) {
						console.log("There was no client with that name/shortkey");
					}
					else {
						selectFromList(clients, null, function (err, result) {
							if (err) {
								console.log(err);
								process.exit(-1);
							}

							id = result.id;
						});
					}
				}
				else {
					id = clients.id;
				}

				var list = (what === "pos") ? model.InvoicePos.listByClient : model.Invoice.listByClient;

				list(id, function (err, rows) {
					if (err) {
						console.log(err);
						process.exit(-1);
					}

					asTable({rows: rows});
				});

			});
		}
	}

  // #### SUM ###
  // summarize time taken
  else if (verb === "sum") {

    var client = argv.c || argv.s;

    getSingleClient(function (err, client) {

    filts = [
      ["archived", 0],
      ["fk_InvoicePos is null"],
      ["clientid", client.id]
    ];

      model.Time.list(filts, function(err, rows) {
        if (err) {
          throw err;
        }
        var sum = moment.duration(0);

        rows.forEach(function (row) {
          sum.add(row.diff);
        });
        console.log("Duration for client " + client.name + ": " + formatDuration(sum));
      });
    });
  }

  // #### COMMIT ###
  // commits tracked times or invoice positions
  else if (verb === 'commit') {
    var what = argv._[1]; // commit what?
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
				asTable({ rows: rows, keyList: cols});

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
				var value = rls.question("Value per hour (" + hourlyWage + "): ") || hourlyWage;
				var quantity = rls.question("Quantity (" + Math.ceil(quantity) + "): ") || Math.ceil(quantity);

				// save changes!
				model.InvoicePos.create(ids, quantity, value, title, description);
			});
		}
		else if (what === "pos") {
			var client = {}
			if (argv.c) {
				client.name = argv.c;
			}
			else if (argv.s) {
				client.short = argv.s;
			}
			else {
				console.log("You need to supply a client with -c|--client or -s|--short");
				process.exit(-1);
			}


			getClient(client, function (err, rows) {
				if (err) {
					console.log("There was an Error retreiving the client records from the database:", err);
					process.exit(-1);
				}

				var client;
				if (rows.length === 0) {
					console.log("There was no client with that name or short key!");
					process.exit(-1);
				}
				else if (rows.length > 1) {
					selectFromList(rows, null, function (err, result) {
						if (err) {
							console.log("Error chosing from the client list!");
							process.exit(-1);
						}

						client = result;
					});
				}
				else {
					client = rows[0];
				}

				model.InvoicePos.listUndoneByClient(client.id, function (err, rows) {
					if (err) {
						console.log(err);
						process.exit(-1);
					}

					var options = {
						question: "Select 'all' invoice items or a comma seprated ID list: ",
						allowAll: true
					};

					selectFromList(rows, options, function (err, result) {
						if (err) {
							console.log(err);
							process.exit(-1);
						}

						var ids = result.map(function (item) {
							return item.id;
						});

						model.Invoice.create(ids, new Date());
					});
				});
			});
		}
		else {
			usage('commit', true);
		}
  }

	// #### INVOICE ###
	// prints or sends Invoices
	else if (verb === 'invoice') {
		if (!argv.c && !argv.s) {
			console.log("You need to specify a client to print or send invoices!");
			process.exit(-1);
		}

		getSingleClient(function (err, client) {
			if (err) {
				console.log("Couldn't get Client from database: " + err);
				process.exit(-1);
			}

			if (!client) {
				console.log("Couldn't find a Client with that name or shortkey!");
				process.exit(0);
			}

			var invtpl = require('./invoice.js')(null, conf);
			model.Invoice.listByClient(client.id, function (err, invoices) {
				if (err) {
					console.log("Couldn't get Invoices from database: " + err);
					process.exit(-1);
				}

				if (!invoices) {
					console.log("There are no invoices for that client! Please create an invoice first using 'tim commit pos'");
					process.exit(0);
				}

				var invoice;
				if (invoices.constructor === Array && invoices.length > 1) {
					selectFromList(invoices, null, function (err, result) {
						if (err) {
							console.log("There was a problem chosing one of the invoices!");
							process.exit(-1);
						}

						invoice = result;
					});
				}
				else {
					invoice = invoices[0];
				}

				//TODO: generate invoice
				model.Invoice.populateItems(invoice, function (err, inv) {
					invtpl.create(client, inv);
				});
			});
		});
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
		conf.datadir = datadir;
		conf.hourlyDefaultWage = rls.question("What will be your default hourly wage? ");
		conf.invoiceDir = rls.question("Where should Invoices be saved to? ");
		fs.lstat(conf.invoiceDir, function(err, stats) {
			if (err || !stats.isDirectory()) {
				console.log("The path '" + conf.invoiceDir + "' is not a valid directory!", err);
				process.exit(-1);
			}
			var model = require('./model.js')(path.join(datadir, dbname), debug);
			model.initDb();
			saveConfig();
		});
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
  date = (date) ? new Date(date) : new Date();
  if (!(date instanceof Date || date.toString() === "Invalid Date"))
    throw "This is not a valid Date";

	model.Time.start(client, title, description, date, function (err) {
		if (err)
			throw err;
		else
			console.log("Time tracking started for", client.name + "!");
	});
}

function getSingleClient(callback) {
	var client = {};
	if (argv.c)
		client.name = argv.c;
	else if (argv.s)
		client.short = argv.s;

	getClient(client, function(err, clients) {
		if (err) {
			return callback(err);
		}

		if (clients && clients.constructor === Array && clients.length === 1) {
			return callback(err, clients[0]);
		}
		else if (!clients || clients.length === 0) {
			return callback(err, null);
		}
		else {
			selectFromList(clients, options, function (err, client) {
				return (err, client);
			});
		}
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

	usage['commit'] = new Array();
	usage['commit'].push("\ttim commit - Combines tracked times into an invoice position");
	usage['commit'].push("\ttim commit times|pos (-c|--client clientName)|(-s|--short shortKey)");

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
