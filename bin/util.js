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
		asTable.apply(this, [list]);
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

	utils.asTable = function () {
		// arguments:
		var objectArray = (arguments[0].constructor === Array) ? arguments[0] : arguments;
		var keyList = Array.prototype.slice.call(arguments, 1);

		var keys = [];       // contains all key names of objects stored in objectArray
		var keydict = [];
		var maxlength = []; // max length for every column
		var formats = [];

		// validate arguments: objectArray
		if (!objectArray) {
			throw {"name": "ArgumentInvalidEx", "msg": "You must supply at least one object to print as table"};
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
				maxlength[key[0]] = String(key[1]).length;
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

	return utils;
}()
