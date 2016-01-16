module.exports = function() {
	var model = {};

	model.debuglog = function(str) {
		if (debug)
			console.log("[DEBUG] " + str);
	}


	model.stripNull = function(str) {
		if (typeof str === 'undefined' || str === null)
			return "";
		else
			return str;
	}

	return model;
}()
