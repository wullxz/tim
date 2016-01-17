module.exports = function (dbpath, debugoutput) {
	var debug = debugoutput || false;
	var model = {};
	var async = require('async');
	var sqlite3 = require('sqlite3').verbose();
	var moment = require('moment');
	require('moment-duration-format'); // duration format addon for momentjs
	var utils = require('./util.js');
	var db  = new sqlite3.Database(dbpath);
	// make all util functions global
	for (var key in utils)
		global[key] = utils[key];
	//model.db = db;

	/**
	 * Create the initial structure for the database:
	 * - tables
	 * - indices
	 * - foreign-keys
	 */
	model.initDb = function() {
		//TODO: init database structure
		function createClients(callback) {
			var qry = new Qry();
			qry.name = "Create: Clients";
			qry.add("CREATE TABLE IF NOT EXISTS Clients (");
			qry.add("		id INTEGER PRIMARY KEY,");
			qry.add("		name TEXT,");
			qry.add("		street1 TEXT,");
			qry.add("		street2 TEXT,");
			qry.add("		zip TEXT,");
			qry.add("		city TEXT,");
			qry.add("   email TEXT,");
			qry.add("		short TEXT UNIQUE);");
			db.run(qry.qry(), [], function(err, result) {
				if (err) {
					debuglog("Error running query:\n" + cli + "\n\nErrors:\n" + err);
				}
				else
					debuglog("Query " + qry.name + " successful!");
				if (result)
					debuglog("Results:\n" + result);

				callback(null, "Clients");
			});
		}

		function createClientsIndex(callback) {
			var qry = new Qry();
			qry.name = "Create: Clients Index";
			qry.add("CREATE UNIQUE INDEX IF NOT EXISTS clientShort ON Clients(short);");
			db.run(qry.qry(), [], function(err, result) {
				if (err)
					debuglog("Error running query:\n" + qry.qry() + "\n\nErrors:\n" + err);
				else
					debuglog("Query " + qry.name + " successful!");
				if (result)
					debuglog("Results:\n" + result);

				callback();
			});
		}

		function createInvoices(callback) {
			var qry = new Qry();
			qry.name = "Create: Invoices";
			qry.add("CREATE TABLE IF NOT EXISTS Invoices (");
			qry.add("		id INTEGER PRIMARY KEY,");
			qry.add("		date DATETIME,");
			qry.add("		fk_Clients INTEGER,");
			qry.add("		FOREIGN KEY(fk_Clients) REFERENCES Clients(id));");
			db.run(qry.qry(), [], function(err, result) {
				if (err)
					debuglog("Error running query:\n" + qry.qry() + "\n\nErrors:\n" + err);
				else
					debuglog("Query " + qry.name + " successful!");
				if (result)
					debuglog("Results:\n" + result);

				callback();
			});
		}

		function createInvoicePos(callback) {
			var qry = new Qry();
			qry.name = "Create: InvoicePos";
			qry.add("CREATE TABLE IF NOT EXISTS InvoicePos (");
			qry.add("		id INTEGER PRIMARY KEY,");
			qry.add("		title TEXT,");
			qry.add("		quantity NUMERIC,");
			qry.add("		value NUMERIC,");
			qry.add("		description TEXT,");
			qry.add("		fk_Clients INTEGER,");
			qry.add("		fk_Invoices INTEGER,");
			qry.add("		FOREIGN KEY(fk_Clients) REFERENCES Clients(id)");
			qry.add("		FOREIGN KEY(fk_Invoices) REFERENCES Invoices(id));");
			db.run(qry.qry(), [], function(err, result) {
				if (err)
					debuglog("Error running query:\n" + qry.qry() + "\n\nErrors:\n" + err);
				else
					debuglog("Query " + qry.name + " successful!");
				if (result)
					debuglog("Results:\n" + result);

				callback();
			});
		}

		function createTimes(callback) {
			var qry = new Qry();
			qry.name = "Create: Times";
			qry.add("CREATE TABLE IF NOT EXISTS Times (");
			qry.add("		id INTEGER PRIMARY KEY AUTOINCREMENT,");
			qry.add("		start DATETIME,");
			qry.add("		end DATETIME,");
			qry.add("		title TEXT,");
			qry.add("		description TEXT,");
			qry.add("		archived INTEGER DEFAULT 0,");
			qry.add("		fk_Clients INTEGER,");
			qry.add("		fk_InvoicePos INTEGER,");
			qry.add("		FOREIGN KEY(fk_Clients) REFERENCES Clients(id),");
			qry.add("		FOREIGN KEY(fk_InvoicePos) REFERENCES InvoicePos(id));");
			db.run(qry.qry(), [], function(err, result) {
				if (err)
					debuglog("Error running query:\n" + qry.qry() + "\n\nErrors:\n" + err);
				else
					debuglog("Query " + qry.name + " successful!");
				if (result)
					debuglog("Results:\n" + result);

				callback();
			});
		}

		//TODO: is this really needed?
		function createStaging(callback) {
			var qry = new Qry();
			qry.add("CREATE TABLE IF NOT EXISTS Staging (");
			qry.add("   id INTEGER NOT NULL,").add("   type TEXT NOT NULL;");
			db.run(qry.qry(), [], function (err, result) {
				if (err)
					debuglog("Error running query:\n" + times + "\n\nErrors:\n" + err);
				else
					debuglog("Query for Staging successful!");
				if (result)
					debuglog("Results:\n" + result);

				callback();
			});
		}

		debuglog("Run all CREATE queries:\n");
		async.series([
				createClients,
				createClientsIndex,
				createInvoices,
				createInvoicePos,
				createTimes
		], function(err, result) {
			console.log("Done creating database.");
		});
	};

	/*
	 * ######### MODELS START ###########
	 */

	/**
	 * Clients model
	 */
	model.Client = function (name, street1, street2, zip, city, shortKey) {
		if (typeof name === 'undefined' && name != null) {
			console.log("You need to specify a name for the client!");
			return null;
		}

		this.name = name;
		this.street1 = street1;
		this.street2 = street2;
		this.zip = zip;
		this.city = city;
		this.short = shortKey;
	}

	model.Client.create = function (client, callback) {
		var st = db.prepare("INSERT INTO Clients (name, street1, street2, zip, city, short) VALUES ($name, $street1, $street2, $zip, $city, $short)");
		debuglog("trying to bind these values:\n" + JSON.stringify(client, null, 2));
		st.run(client, function (err) {
			if (err) {
				console.log(err);
			}
			else {
				console.log(this);
			}

			// callback!
			if (callback) callback(err);
		});
	}

	model.Client.findByName = function(pattern, callback) {
		var st = db.prepare("SELECT * FROM Clients where name LIKE '%'||$name||'%'");
		var n = null;
		if ("$name" in pattern)
			n = { $name: pattern.$name };
		else
			n = { $name: pattern};

		debuglog("binding values: " + JSON.stringify(n));

		st.all(n, function (err, rows) {
			callback(err, rows);
		});
	}

	model.Client.findByKey = function (key, callback) {
		var st = db.prepare("SELECT * FROM Clients where short = $short");
		st.all(key, function (err, rows) {
			callback(err, rows);
		});
	}

	/**
	 * Time model
	 */

	model.Time = function (id, start, end, title, description, invoiced, archived, fk_timesclient, fk_timesinvoicepos) {
		this.id = id;
		this.start = start;
		this.end = end;
		this.title = title;
		this.description = description;
		this.invoiced = invoiced;
		this.archived = archived;
		this.fk_timesclient = fk_timesclient;
		this.fk_timesinvoicepos = fk_timesinvoicepos;
	}

	model.Time.start = function (client, title, description, start, callback) {
		if (!client || !title || !start)
			throw "Wrong parameters!";
		var st = db.prepare("INSERT INTO Times (fk_timesclient, title, description, start) VALUES ($client, $title, $description, $start);");

		if (client instanceof Array && client.length == 1)
			client = client[0]; // array given but only one item in array... taking it!

		var params = { $client: client.id, $title: title, $description: description, $start: start };
		st.run(params, function(err) {
			callback(err);
		});
	}

	model.Time.status = function (callback) {
		var st = db.prepare("SELECT t.*, c.id clientid, c.name clientname FROM Times t JOIN Clients c ON t.fk_timesclient=c.id WHERE end IS NULL" );

		st.get([], function (err, row)  {
			if (!err && row) {
				data = {};
				data.row = row;

				var start = new Date(row.start);
				data.diffstr = moment.duration(moment().diff(start)).format('H [hours] m [minutes] s [seconds]');
				data.diff = moment.duration(moment().diff(start));
				callback(err, data);
			}
			else {
				callback (err, undefined);
			}
		});
	}

	/**
	 * ends the most recent time tracking
	 */
	model.Time.stop = function (end, callback) {
		if (!end)
			throw "Please supply an end date!";

		var qry = "update Times set end=$end where end is null";
		var st = db.prepare(qry);
		st.run({$end: end}, function(err) {
			callback(err);
		});
	}

	model.Time.list = function (filters, callback) {
		if (filters && !(filters instanceof Array))
			throw "filters parameter must be an array or null";

		// base query
		var qry = "select t.*, c.id clientid, c.name clientname, c.short shortKey from Times t JOIN Clients c ON t.fk_timesclient=c.id";

		// process filters
		var params = {};
		if (filters) {
			qry += " where ";
			var junctor = " AND ";
			for (var i=0; i<filters.length; i++) {
				var item = filters[i];
				if (i>=1)
					qry += junctor;

				if (item.length == 2) {
					qry += item[0] + "=$" + item[0];
				}
				else if (item.length == 3) {
					qry += item[0] + " " + item[2] + " $" + item[0];
				}
				else {
					qry += ""+item[0];
					continue;
				}

				// this builds the params object which will be used
				// in the parameterized query
				params['$'+item[0]] = item[1];
			}
		}

		// run query
		debuglog("running query: " + qry);
		var st = db.prepare(qry);
		st.all(params, function (err, rows) {
			for (var i=0; i<rows.length; i++) {
				var row = rows[i];

				// calc duration
				var start = new Date(row.start);
				var end = new Date(row.end);
				row.diffstr = moment.duration(moment(end).diff(start)).format('H [hours] m [minutes] s [seconds]');
				row.diff = moment.duration(moment(end).diff(start));
			}

			callback(err, rows);
		});
	};

	model.InvoicePos = function () {

	}

	model.InvoicePos.create = function (times) {
		if (times.constructor !== Array || times.length == 0)
			throw "times parameter must be an array of Time IDs or model.Time instances!";

		// get all time records from database
		var tobjs = [];         // list of time objects
		var qry = "select * from times where id=$id";
		db.serialize(function() { // need to serialize database queries!
			for (var i=0; i<times.length; i++) {
				if (times[i] instanceof model.Time) {
					tobjs.push(times[i]);
				}
				else {
					var st = db.prepare(qry);
					st.get([{"$id": times[i]}], function (err, row) {
						if (err)
							throw "There was an error retreiving all time records from the database! ID: " + times[i];

						tobjs.push(row);
					});
				}
			}
		});
	}

	/*
	 * ######## MODELS END #########
	 */

	/**
	 * convenience method to write multiline SQL queries
	 */
	function qB (str, line) {
		str = str + "\n" + line;
		return str;
	}

	function Qry() {
		this._qry = "";
	}

	Qry.prototype.add = function (string) {
		this._qry = this._qry + "\n" + string;
		return this;
	}

	Qry.prototype.qry = function () {
		return this._qry;
	}

	return model;
}
