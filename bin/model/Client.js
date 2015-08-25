// db should be defined already...
var db = new Seq('main', null, null, { host: 'localhost', dialect: 'sqlite', storage: path.join(datadir, 'db.sqlite') });

// create tables

var Clients = db.define('Clients', {
  name: Seq.STRING,
  street1: Seq.STRING,
  street2: Seq.STRING,
  zip: Seq.STRING(7),
  city: Seq.STRING
});

var Invoices = db.define('Invoices', {
  date: Seq.DATE
});

var TimeTrackings = db.define('TimeTrackings', {
  start: Seq.DATE,
  end: Seq.DATE,
  title: Seq.STRING,
  description: Seq.TEXT
});

// set relations
Invoices.hasMany(Clients);
TimeTrackings.hasMany(Clients);

