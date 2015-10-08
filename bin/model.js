module.exports = function (dbpath, debugOutput) {
	var debug = debugOutput || false;
	var model = {};
	var async = require('async');
	var sqlite3 = require('sqlite3').verbose();
	var db  = new sqlite3.Database(dbpath);
	model.db = db;
	/**
	 * Create the initial structure for the database:
	 * - tables
	 * - indices
	 * - foreign-keys
	 */
	model.initDb = function() {
		//TODO: init database structure
		function createClients(callback) {
			var cli	 = "CREATE TABLE IF NOT EXISTS Clients (";
			cli = qB(cli, "		id INTEGER PRIMARY KEY AUTOINCREMENT,");
			cli = qB(cli, "		name TEXT,");
			cli = qB(cli, "		street1 TEXT,");
			cli = qB(cli, "		street2 TEXT,");
			cli = qB(cli, "		zip TEXT,");
			cli = qB(cli, "		city TEXT,");
			cli = qB(cli, "		short TEXT UNIQUE);");
			model.db.run(cli, [], function(err, result) {
				if (err) {
					debugOut("Error running query:\n" + cli + "\n\nErrors:\n" + err);
				}
				else
					debugOut("Query successful!");
				if (result)
					debugOut("Results:\n" + result);

				callback(null, "Clients");
			});
		}

		function createClientsIndex(callback) {
			var cliU = "CREATE UNIQUE INDEX IF NOT EXISTS clientShort ON Clients(short);";
			model.db.run(cliU, [], function(err, result) {
				if (err)
					debugOut("Error running query:\n" + cliU + "\n\nErrors:\n" + err);
				else
					debugOut("Query successful!");
				if (result)
					debugOut("Results:\n" + result);

				callback();
			});
		}

		function createInvoices(callback) {
			var invoices = "CREATE TABLE IF NOT EXISTS Invoices (";
			invoices = qB(invoices, "		id INTEGER PRIMARY KEY,");
			invoices = qB(invoices, "		date DATETIME,");
			invoices = qB(invoices, "		ClientId INTEGER,");
			invoices = qB(invoices, "		fk_invoiceclient INTEGER,");
			invoices = qB(invoices, "		FOREIGN KEY(fk_invoiceclient) REFERENCES Clients(id));");
			model.db.run(invoices, [], function(err, result) {
				if (err)
					debugOut("Error running query:\n" + invoices + "\n\nErrors:\n" + err);
				else
					debugOut("Query successful!");
				if (result)
					debugOut("Results:\n" + result);

				callback();
			});
		}

		function createInvoicePos(callback) {
			var invoicepos = "CREATE TABLE IF NOT EXISTS InvoicePos (";
			invoicepos = qB(invoicepos, "		id INTEGER PRIMARY KEY,");
			invoicepos = qB(invoicepos, "		title TEXT,");
			invoicepos = qB(invoicepos, "		quantity NUMERIC,");
			invoicepos = qB(invoicepos, "		value NUMERIC,");
			invoicepos = qB(invoicepos, "		description TEXT,");
			invoicepos = qB(invoicepos, "		fk_invoiceposinvoice INTEGER,");
			invoicepos = qB(invoicepos, "		FOREIGN KEY(fk_invoiceposinvoice) REFERENCES Invoice(id));");
			model.db.run(invoicepos, [], function(err, result) {
				if (err)
					debugOut("Error running query:\n" + invoicepos + "\n\nErrors:\n" + err);
				else
					debugOut("Query successful!");
				if (result)
					debugOut("Results:\n" + result);

				callback();
			});
		}

		function createTimes(callback) {
			var times = "CREATE TABLE IF NOT EXISTS Times (";
			times = qB(times, "		id INTEGER PRIMARY KEY AUTOINCREMENT,");
			times = qB(times, "		start DATETIME,");
			times = qB(times, "		end DATETIME,");
			times = qB(times, "		title TEXT,");
			times = qB(times, "		description TEXT,");
			times = qB(times, "		invoiced INTEGER DEFAULT 0,");
			times = qB(times, "		fk_timesclient INTEGER,");
			times = qB(times, "		fk_timesinvoicepos INTEGER,");
			times = qB(times, "		FOREIGN KEY(fk_timesclient) REFERENCES Clients(id),");
			times = qB(times, "		FOREIGN KEY(fk_timesinvoicepos) REFERENCES InvoicePos(id));");
			model.db.run(times, [], function(err, result) {
				if (err)
					debugOut("Error running query:\n" + times + "\n\nErrors:\n" + err);
				else
					debugOut("Query successful!");
				if (result)
					debugOut("Results:\n" + result);

				callback();
			});
		}

		debugOut("Run all CREATE queries:\n");
		async.series([
				createClients,
				createClientsIndex,
				createInvoices,
				createInvoicePos,
				createTimes
		], function(err, result) {
			debugOut("Done.");
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
		debugOut("trying to bind these values:\n" + JSON.stringify(client, null, 2));
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

		debugOut("binding values:\n" + JSON.stringify(n));

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

	model.Time = function () {

	}

	model.Time.start = function (client, title, description, start, callback) {
		var st = db.prepare("INSERT INTO Times (fk_timesclient, title, description, start) VALUES ($client, $title, $description, $start);");

		var params = { $client: client.id, $title: title, $description: description, $start: start };
		st.run(params, function(err) {
			if (err)
				throw err;
			else
				console.log(this);
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

	/**
	 * convenience method to write output only if debugging is enabled for this module
	 */
	function debugOut(msg) {
		if (debug)
			console.log("[DEBUG] " + msg);
	}

	return model;
}
