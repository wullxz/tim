module.exports = function (dbpath, debugOutput) {
	var debug = debugOutput || false;
	var model = {};
	var sqlite3 = require('sqlite3').verbose();
	model.db = new sqlite3.Database(dbpath);

	model.initDb = function() {
		//TODO: init database structure
		var stmts = [];
		var s	 = "CREATE TABLE IF NOT EXISTS Clients (";
		s = qB(s, "		id INT PRIMARY KEY,");
		s = qB(s, "		name TEXT,");
		s = qB(s, "		street1 TEXT,");
		s = qB(s, "		street2 TEXT,");
		s = qB(s, "		zip TEXT,");
		s = qB(s, "		city TEXT,");
		s = qB(s, "		short TEXT);");
		stmts.push(s);
		s = "CREATE UNIQUE INDEX clientShort ON Clients(short);";
		stmts.push(s);

		s = "CREATE TABLE IF NOT EXISTS Invoices (";
		s = qB(s, "		id INT PRIMARY KEY,");
		s = qB(s, "		date DATETIME,");
		s = qB(s, "		ClientId INT,");
		s = qB(s, "		FOREIGN KEY(fk_invoiceclient) REFERENCES Clients(id));");
		stmts.push(s);

		s = "CREATE TABLE IF NOT EXISTS InvoicePos (";
		s = qB(s, "		id INT PRIMARY KEY,");
		s = qB(s, "		title TEXT,");
		s = qB(s, "		quantity NUMERIC,");
		s = qB(s, "		value NUMERIC,");
		s = qB(s, "		description TEXT,");
		s = qB(s, "		fk_invoiceposinvoice INT,");
		s = qB(s, "		FOREIGN KEY(fk_invoiceposinvoice) REFERENCE Invoice(id));");

		s = "CREATE TABLE IF NOT EXISTS Times (";
		s = qB(s, "		id INT PRIMARY KEY,");
		s = qB(s, "		start DATETIME,");
		s = qB(s, "		end DATETIME,");
		s = qB(s, "		title TEXT,");
		s = qB(s, "		description TEXT,");
		s = qB(s, "		fk_timesclient INT,");
		s = qB(s, "		fk_timesinvoicepos INT,");
		s = qB(s, "		FOREIGN KEY(fk_timesclient) REFERENCES Clients(id),");
		s = qB(s, "		FOREIGN KEY(fk_timesinvoicepos) REFERENCES InvoicePos(id));");
		stmts.push(s);

		debugOut("Running db init queries now!");
		var count = 0;
		stmts.forEach(function (stmt) {
			count++;
			var i=count;
			debugOut("Running following query (" + i + ") now:\n" + stmt);
			model.db.run(stmt, null, function(err) {
				debugOut("Error running query (" + i + ")! Errors:\n" + JSON.stringify(err, null, 2));
			});
		});
	};

	function qB (str, line) {
		str = str + "\n" + line;
		return str;
	}

	function debugOut(msg) {
		if (debug)
			console.log(msg);
	}

	return model;
}
