module.exports = function (template, config) {
	template = template || "./tpl/invoice.ejs";

	// Invoice object to be returned
	var invoice = {};

	function padToFour(number) {
		  if (number<=9999) { number = ("000"+number).slice(-4); }
			  return number;
	}

	invoice.create = function (client, invoice) {
		var ejs = require('ejs');
		var fs = require('fs');
		var path = require('path');
		var pdf = require('html-pdf');
		var moment = require('moment');
		var printf = require('sprintf-js').sprintf;
		var invoiceno = padToFour(invoice.id);
		var opener = require('opener');

		var filename = path.join(config.invoiceDir, (invoiceno + ".pdf"));

		var tplstr = fs.readFileSync(template, 'utf-8');
		var dateFormatted = moment(invoice.date).format('ll');
		console.log(invoiceno);
		var data = { "client": client, "items": invoice.items, "invoiceno": invoiceno, "invoicedate": dateFormatted};
		var html = ejs.render(tplstr, data);


		if (debug) {
			var os = require('os');
			var htmlFile = path.join(os.tmpDir(), "invoice.html");
			fs.writeFile(htmlFile, html, function (err) {
				if (err) {
					return console.log(err);
				}

				//opener(htmlFile).unref();
			});
		}

		options = {format: 'Letter'};
		console.log("Writing invoice pdf to: " + filename);
		pdf.create(html, options).toFile(filename, function(err, res) {
			if (err) return console.log(err);

			opener(filename).unref();
			process.exit(0);
		});
	}

	return invoice;
}
