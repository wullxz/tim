#!/usr/bin/env node

var debug = true;

// include packages
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var minimist = require('minimist');
var sqlite = require('sqlite3');
//var Seq = require('sequelize'); // db package
var os = require('os');
var tmpdir = (os.tmpdir || os.tmpDir)();
var printf = require('sprintf-js').sprintf;
var readline = require('readline');

// db model vars
var Client = null, Invoice = null, TrackedTime = null;

// parse commandline args
var argv = minimist(process.argv.slice(2), {
	alias: { v: 'verbose', h: 'help', c: 'client', s: 'short', t: 'title', d: 'description' }
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
var m = require('./model.js')(path.join(datadir, 'db.sqlite'), debug);

function openDb(callback, cbargs) {
	// ########## model definition here! #####
	Client = db.define('Client', {
		name: Seq.STRING,
		street1: Seq.STRING,
		street2: Seq.STRING,
		zip: Seq.STRING(7),
		city: Seq.STRING,
		short: { type: Seq.STRING(10), unique: true, allowNull: true }
	});

	Invoice = db.define('Invoice', {
		date: Seq.DATE
	});

	TrackedTime = db.define('TrackedTime', {
		start: Seq.DATE,
		end: Seq.DATE,
		title: Seq.STRING,
		description: Seq.TEXT
	});

	InvoicePosition = db.define('InvoicePosition', {
		title: Seq.STRING(100),
		qty: Seq.DOUBLE,
		value: Seq.DOUBLE,
		desc: Seq.STRING
	});

	// relations
	Client.hasMany(Invoice);
	Client.hasMany(TrackedTime);
	Invoice.hasMany(InvoicePosition);
	InvoicePosition.hasMany(TrackedTime);

	// ########## model definition end!  #####

	//TODO: specify relations
	//INFO: http://www.redotheweb.com/2013/02/20/sequelize-the-javascript-orm-in-practice.html

	//TODO: initialize DB if not done already

	// save changes to db:
	Client.sync();
	Invoice.sync();
	TrackedTime.sync();
	db.sync();
	conf.init = 1;
	saveConfig();
	dbopen = true;
	callback(cbargs);
}

function test(create) {
	m.initDb();
	//	if (create==='create') {
	//		console.log('saving some clients now...');
	//		Client.create({
	//			name: "Max Mustermann",
	//			street1: "Somestreet 123",
	//			zip: "12345",
	//			city: "Musterstadt"
	//		})
	//		Client.create({
	//			name: "Ulla Musterfrau",
	//			street1: "Sesamstraße 123",
	//			zip: "12345",
	//			city: "Musterstadt"
	//		});
	//		console.log('saved client data!\n');
	//	}
	//
	//	console.log('outputting client data:');
	//	Client.findAll().then(function (clients) {
	//		if (typeof clients == 'undefined' || ! clients) {
	//			console.log('error fetching clients!\n');
	//			return -1;
	//		}
	//		clients.forEach(function(client) {
	//			console.log('found client: ' + client.name);
	//			console.log('address: ' + client.street1 + " - " + client.zip + " " + client.city);
	//			console.log('---------------------------------');
	//		});
	//	});
}

/**
 *  processes commandline args
 */
function proc(argv) {
	//	if (!dbopen) {
	//		openDb(proc, argv);
	//		return;
	//	}

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
		if (target === 'client') {
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

	// ##### TEST ####
	// for testing stuff
	else if (verb === 'test') {
		test(argv.t);
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

	debuglog('\nClient object:\n', JSON.stringify(client, null, 2));
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
	usage['search'][0] = "\ttim search client (-c|--client pattern)|(-s|--short key)";

	// help for add keyword
	usage['add'] = new Array(),
	usage['add'][0] = "\ttim add client -c|--client ClientName [--street1 value] [--street2 value] [--zip zip] [--city city] [--short shortkey]";

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
