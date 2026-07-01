const dns = require('dns');

async function run() {
  const targetIp = '2406:da12:557:f800:d29a:c9:3268:d804';
  
  try {
    console.log("Fetching AWS IP ranges...");
    const res = await fetch('https://ip-ranges.amazonaws.com/ip-ranges.json');
    const data = await res.json();
    console.log(`Loaded ${data.ipv6_prefixes.length} IPv6 prefixes.`);
    
    // We will parse IPv6 prefixes.
    // Address in subnet check is easiest by converting to bigints or finding partial prefix matches.
    // targetIp prefix starts with "2406:da12:557:"
    
    const matches = [];
    for (const prefix of data.ipv6_prefixes) {
      if (prefix.ipv6_prefix.startsWith('2406:da12')) {
        matches.push(prefix);
      }
    }
    
    console.log("\nMatching AWS prefixes for 2406:da12:");
    console.log(JSON.stringify(matches, null, 2));

  } catch (err) {
    console.error("Failed:", err.message);
  }
}

run();
