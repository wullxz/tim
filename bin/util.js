module.exports = function () {
	var util = {};

	util.debuglog = function debuglog(str) {
	  if (debug)
	    console.log("[DEBUG] " + str);
	}


	util.debuglog = function stripNull(str) {
	  if (typeof str === 'undefined' || str === null)
	    return "";
	  else
	    return str;
	}

	return util;
}
