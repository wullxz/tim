var Client = db.define('Client', {
  name: Seq.STRING,
  street1: Seq.STRING,
  street2: Seq.STRING,
  zip: Seq.STRING(7),
  city: Seq.STRING
});

