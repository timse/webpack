var fs = require("fs");
var path = require("path");

module.exports = function(config) {
	return fs.existsSync(path.resolve(__dirname, "TEST.FILTER.JS"));
};
