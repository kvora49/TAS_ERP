const dns = require('dns');

dns.lookup('aws-0-us-east-1.pooler.supabase.com', { all: true }, (err, addresses) => {
  if (err) {
    console.error("DNS lookup failed:", err.message);
  } else {
    console.log("Resolved addresses:", addresses);
  }
});
