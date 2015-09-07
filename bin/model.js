module.exports = function (dbpath, debugOutput) {
	var debug = debugOutput || false;
	var model = {};
	var async = require('async');
	var sqlite3 = require('sqlite3').verbose();
	model.db = new sqlite3.Database(dbpath);

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
			cli = qB(cli, "		id INT PRIMARY KEY,");
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
			invoices = qB(invoices, "		id INT PRIMARY KEY,");
			invoices = qB(invoices, "		date DATETIME,");
			invoices = qB(invoices, "		ClientId INT,");
			invoices = qB(invoices, "		fk_invoiceclient INT,");
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
			invoicepos = qB(invoicepos, "		id INT PRIMARY KEY,");
			invoicepos = qB(invoicepos, "		title TEXT,");
			invoicepos = qB(invoicepos, "		quantity NUMERIC,");
			invoicepos = qB(invoicepos, "		value NUMERIC,");
			invoicepos = qB(invoicepos, "		description TEXT,");
			invoicepos = qB(invoicepos, "		fk_invoiceposinvoice INT,");
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
			times = qB(times, "		id INT PRIMARY KEY,");
			times = qB(times, "		start DATETIME,");
			times = qB(times, "		end DATETIME,");
			times = qB(times, "		title TEXT,");
			times = qB(times, "		description TEXT,");
			times = qB(times, "		fk_timesclient INT,");
			times = qB(times, "		fk_timesinvoicepos INT,");
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

	/**
	 * Clients model
	 */

	 //TODO: create client model 

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
		console.log(msg);
	}

	return model;
}
