#!/bin/sh
set -e

# Update CA certificates if the custom CA was mounted (requires root)
if [ -f /usr/local/share/ca-certificates/owlboard-ca.crt ]; then
    echo "Installing custom CA certificate..."
    update-ca-certificates
    echo "CA certificate installed successfully"
    
    # Set NODE_EXTRA_CA_CERTS to include the custom CA for Node.js
    export NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/owlboard-ca.crt
    echo "Node.js configured to trust custom CA"
fi

# Switch to nextjs user and start the server
exec su-exec nextjs node server.js
