module.exports = function (template) {
	template = template || "./tpl/invoice.ejs";

	// Invoice object to be returned
	var invoice = {};

	invoice.create = function (client, positions, invoiceno, invoicedate) {
		var ejs = require('ejs');
    var fs = require('fs');
    var os = require('os');

    var tplstr = fs.readFileSync(template, 'utf-8');
    var data = { "client": client, "positions": positions, "invoiceno": invoiceno, "invoicedate": invoicedate };
    var html = ejs.render(tplstr, data);
    fs.writeFile(os.tmpdir() + "/invoice.html", html, function (err) {
      if (err)
        return console.log(err);

      console.log("Invoice html was saved to $tmpdir/invoice.html");
    });
	}

  return invoice;
}
