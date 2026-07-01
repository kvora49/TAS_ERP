const { Resolver } = require('dns');
const resolver = new Resolver();
resolver.setServers(['8.8.8.8']);

resolver.resolve4('db.cxekeitxvfkukujselxr.supabase.co', (err, addresses) => {
  if (err) {
    console.error("Public DNS resolution failed:", err.message);
  } else {
    console.log("Resolved IPv4 addresses:", addresses);
  }
});
