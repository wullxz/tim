#!/usr/bin/env node

// include packages
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var minimist = require('minimist');
var sqlite = require('sqlite3');
var Seq = require('sequelize'); // db package
var strftime = require('strftime');
var stringify = require('json-stable-stringify');
var os = require('os');
var tmpdir = (os.tmpdir || os.tmpDir)();
var printf = require('sprintf-js').sprintf;

// db model vars
var Client = null, Invoice = null, TrackedTime = null;

var argv = minimist(process.argv.slice(2), {
	alias: { v: 'verbose', h: 'help', c: 'client', s: 'short', t: 'test' }
});

// create data directory and config
var dbopen = false;
var HOME = process.env.HOME || process.env.USERPROFILE;
var datadir = argv.d || path.join(HOME, '.tim');
mkdirp.sync(datadir);
var confpath = path.join(datadir, 'settings.json');
var conf;
try { conf = fs.statSync(confpath) } catch (err) { conf = { isFile: function () { return false; } } }
conf = (conf.isFile()) ? fs.readFileSync(confpath, { encoding: 'utf8' }).toString() : "";
conf = (conf.trim() === "") ? {} : JSON.parse(conf);

//TODO: make this setting accessable for the user in order to let him save it in dropbox or so
var dblogging = false;
var db = new Seq('main', null, null, { host: 'localhost', dialect: 'sqlite', storage: path.join(datadir, 'db.sqlite'), logging: dblogging});


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
		name: Seq.STRING(100),
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
	if (create==='create') {
		console.log('saving some clients now...');
		Client.create({
			name: "Max Mustermann",
			street1: "Somestreet 123",
			zip: "12345",
			city: "Musterstadt"
		})
		Client.create({
			name: "Ulla Musterfrau",
			street1: "Sesamstraße 123",
			zip: "12345",
			city: "Musterstadt"
		});
		console.log('saved client data!\n');
	}

	console.log('outputting client data:');
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
}

/**
 *  processes commandline args
 */
function proc(argv) {
	if (!dbopen) {
		openDb(proc, argv);
		return;
	}

	var verb = argv._[0];
	if (argv.h) {
		usage(0);
	}
	else if (verb === 'search') {
		if (argv.c) {
			console.log('searching for client: ' + argv.c);
			Client.findAll({
				where: {
					name: {
						$like: '%' + argv.c + '%'
					}
				}
			}).then( function (clients) {
				if (typeof clients == 'undefined' || ! clients) {
					console.log('No clients with that name found!\n');
					return 0;
				}

				console.log(printf("%-5s | %-15s | %-15s | %-6s | %-10s", "ID", "Name", "Street 1", "Zip", "City"));
				clients.forEach(function(client) {
					console.log(printf("%-5s | %-15s | %-15s | %-6s | %-10s", client.id, client.name, client.street1, client.zip, client.city));
				});
			});
		}
		if (argv.s) {
			Client.findAll({
				where: {
					short: argv.s
				}
			}).then( function (clients) {
				if (typeof clients == 'undefined' || ! clients) {
					console.log('No clients with that short key found!\n');
					return 0;
				}

				console.log(printf("%-5s | %-15s | %-15s | %-6s | %-10s", "ID", "Name", "Street 1", "Zip", "City"));
				clients.forEach(function(client) {
					console.log(printf("%-5s | %-15s | %-15s | %-6s | %-10s", client.id, client.name, client.street1, client.zip, client.city));
				});
			});
		}
	}
	else if (verb === 'add') {
		var type = argv._[1];
		if (type === 'client') {
			if (typeof argv.name === 'undefined' || argv.name.trim() === "") {
				console.log("Please supply at least a name for the new customer!");
				process.exit(-1);
			}
			Client.create({
				name: argv.name,
				street1: argv.street1 || "",
				zip: argv.zip+"" || "",
				city: argv.city || "",
				street2: argv.street2 || "",
				short: argv.short || null
			})
		}
	}
	else if (verb === 'test') {
		test(argv.t);
	}
	else {
		usage(-1);
	}
}

function saveConfig() {
	fs.writeFileSync(confpath, JSON.stringify(conf), { encoding: 'utf8' }, function (err) {
		if (err) throw err;
		console.log('Config saved!');
	});
}

function usage(arg) {
	console.log("TODO!");
	process.exit(arg);
}

proc(argv);
