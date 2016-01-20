module.exports = function() {
	var printf = require('sprintf-js').sprintf;
	var utils = {};

	utils.debuglog = function(str) {
		if (debug)
			console.log("[DEBUG] " + str);
	}


	utils.stripNull = function(str) {
		if (typeof str === 'undefined' || str === null)
			return "";
		else
			return str;
	}

	/***
	 * Generic method to let the user chose from a list of objects.
	 *
	 * @returns		the chosen objects from <c>list</c>
	 **/
	utils.selectFromList = function (list, options, callback) {
		var rls = require('readline-sync');
		if (list.constructor !== Array || list.length === 0) {
			callback("You must provide a list (array) of objects to chose from!");
			return;
		}

		// initialize options if user didn't chose everything himself
		if (!options) {
			options = {
				id: "id",
				question: "Select one: ",
				quantity: 1,
				allowAll: false
			}
		}
		else {
			if (!options.id)
				options.id = "id";
			if (!options.question)
				options.question = "Select one: ";
			if (!options.quantity)
				options.question = 1;
			if (!options.allowAll)
				options.allowAll = false;
		}

		// print table and get selection from user
		asTable({ rows: list });
		var answer = rls.question(options.question);
		answer = answer.replace(/ /g, "");
		ids = answer.split(",");

		// convert ids to numbers if possible
		ids = ids.map(function (item) {
			return (Number.isNaN(Number(item))) ? item : Number(item);
		});

		// break if user wants more than he could take
		if ((answer === "all" || ids.length > options.quantity) && !options.allowAll) {
			callback("Too many items selected!");
			return;
		}

		if (answer === "all") {
			callback(null, list);
		}
		else {
			var results = list.filter(function (item) {
				return ids.indexOf(item[options.id]) != -1;
			});
			// return a single object when quantity=1 is chosen
			if (options.quantity === 1 && !options.allowAll && results.length === 1) {
				callback(null, results[0]);
			}
			else {
				callback(null, results);
			}
		}
	}

	utils.asTable = function (data) {
		// arguments:
		// data.rows: an array of objects that need to be displayed
		// data.keyList: object of keys of those objects that should be displayed
		//		example keyList obj:
		//		keyList = {
		//			name: {
		//				alias: "Name",
		//				stripNull: true,
		//				format: string,
		//				align: right
		//			}
		//		}
		// data.options: TODO
		var dataRows = data.rows;
		var keyList = data.keyList || null;
		var options = data.options || null; // not yet implemented - will hold global options for all columns

		var maxlength = []; // max length for every column

		// validate arguments: objectArray
		if (!dataRows) {
			throw {"name": "ArgumentInvalidEx", "msg": "You must supply at least one object to print as table"};
		}

		// validate arguments: keys
		// ... and initialize keyList
		if (!keyList || keyList.length === 0 || (keyList.length === 1 && keyList[0] === "*")) {
			keyList = []; // get rid of "*" element 
			for (var key in dataRows[0]) { // assumes that every object has the same keys
				if (key.constructor !== Function) 
					keyList.push({ name: key, alias: key });
			}
		}

		// also initializes maxlength[key] with the length of the keyname which will be used as header
		keyList.forEach(function(key, index) {
			if (key.constructor === String) {
				key = { name: key, alias: key };
				keyList[index] = key; // i want all keys in keyList to be objects for easier use
			}

			// set default values
			keyList[index].stripNull = keyList[index].stripNull || true;
			keyList[index].format = keyList[index].format || "s";
			keyList[index].align = keyList[index].align || "left";

			maxlength[key.name] = String(key.alias).length;
		});

		// find max length of content for each key
		dataRows.forEach(function (row) {
			keyList.forEach( function (key) {
				if (String(row[key.name]).length > maxlength[key.name]) {
					maxlength[key.name] = String(row[key.name]).length;
				}
			});
		});

		// print header
		var line = "";
		var headerLabels = [];
		keyList.forEach(function(key) {
			line += "%-" + maxlength[key.name] + "s|";   // insert max length of key/value for obj key
			headerLabels.push(key.alias);   // save headers in array
		});
		line = line.substring(0,line.length-1); // remove last "|", line done here

		var ar = headerLabels;
		ar.unshift(line);               // put the format string in front of args array
		console.log(printf.apply(this, ar)); // print headers

		// print content
		// but first rebuild the format line
		line = "";
		keyList.forEach(function (key) {
			line += "%";
			if (key.align === "left") line += "-";
			line += maxlength[key.name];
			line += key.format;
			line += "|";
		});
		line = line.substring(0, line.length -1);
		dataRows.forEach(function (row) { // loop objects
			var rowValues = [];
			keyList.forEach(function (key) {
				// convert null to empty string if configured
				var value = (key.stripNull) ? stripNull(row[key.name]) : row[key.name];
				rowValues.push(value); // push object values into array for each key
			});

			rowValues.unshift(line);
			console.log(printf.apply(this, rowValues));
		});
	}

	utils.stripNullsFromObjects = function (objects, keys) {
		if (objects.constructor !== Array)
			objects = [objects];

		objects.forEach(function (obj) {
			if (keys) {
				for (var key in keys) {
					obj[key] = stripNull(obj[key]);
				}
			}
			else {
				for (var key in obj) {
					obj[key] = stripNull(obj[key]);
				}
			}
		});
		return objects;
	}

	return utils;
}()
