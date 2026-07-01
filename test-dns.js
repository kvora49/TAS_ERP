const dns = require('dns');

dns.lookup('cxekeitxvfkukujselxr.supabase.co', { all: true }, (err, addresses) => {
  if (err) {
    console.error("DNS lookup failed:", err.message);
  } else {
    console.log("Resolved addresses:", addresses);
  }
});
