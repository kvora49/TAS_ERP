const net = require('net');

function testPort(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    console.log(`Connecting to ${host}:${port}...`);
    
    socket.setTimeout(5000);
    
    socket.connect(port, host, () => {
      console.log(`Success! Connected to ${host}:${port}`);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', (err) => {
      console.error(`Failed to connect to ${host}:${port}: ${err.message}`);
      socket.destroy();
      resolve(false);
    });

    socket.on('timeout', () => {
      console.error(`Timeout connecting to ${host}:${port}`);
      socket.destroy();
      resolve(false);
    });
  });
}

async function run() {
  await testPort('portquiz.net', 5432);
  await testPort('portquiz.net', 443);
  process.exit(0);
}

run();
