var Invoice = db.define('Invoice', {
  date: Seq.DATE
});

// set relations
Invoice.hasMany(Client);

