module.exports = function (template, config) {
  var path = require('path');
	template = template || path.join(__dirname, "../tpl", "invoice.ejs");

	// Invoice object to be returned
	var invoice = {};

	function padToFour(number) {
		  if (number<=9999) { number = ("000"+number).slice(-4); }
			  return number;
	}

	invoice.create = function (client, invoice, doopen) {
		var ejs = require('ejs');
		var fs = require('fs');
		var pdf = require('html-pdf');
		var moment = require('moment');
		var printf = require('sprintf-js').sprintf;
		var invoiceno = padToFour(invoice.id);
		var opener = require('opener');
    doopen = doopen !== false;

		var filename = path.join(config.invoiceDir, (invoiceno + ".pdf"));

		var dateFormatted = moment(invoice.date).format('DD.MM.YYYY');
		console.log(invoiceno);
		var data = { "client": client, "items": invoice.items, "invoiceno": invoiceno, "invoicedate": dateFormatted};
		ejs.renderFile(template, data, function (err, html) {
      if (err) {
        console.log("There was an error rendering the invoice: " + err);
        process.exit(-1);
      }

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

      options = {
        format: 'A4',
        "border": {
          "top": "15mm",            // default is 0, units: mm, cm, in, px
          "right": "15mm",
          "bottom": "5mm",
          "left": "15mm"
        },
      };
      console.log("Writing invoice pdf to: " + filename);
      pdf.create(html, options).toFile(filename, function(err, res) {
        if (err) return console.log(err);

        if (doopen) {
          opener(filename).unref();
        }
        process.exit(0);
      });
    });
	}

	return invoice;
}
