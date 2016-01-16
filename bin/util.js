module.exports = function() {
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

	return utils;
}()
