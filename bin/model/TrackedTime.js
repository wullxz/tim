var TrackedTime = db.define('TrackedTime', {
  start: Seq.DATE,
  end: Seq.DATE,
  title: Seq.STRING,
  description: Seq.TEXT
});

// set relations
TrackedTime.hasMany(Client);

