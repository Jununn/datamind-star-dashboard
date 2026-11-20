
# Encrypted DataMind dashboard

The overview and daily Star chart are public. From the GitHub Traffic section onward,
the original document, application code and datasets are stored only inside
`encrypted/dashboard.js`: gzip-compressed JSON, encrypted with AES-256-GCM.
PBKDF2-SHA256 derives the encryption key with 600,000 iterations and a 32-byte salt.
Every encryption uses a fresh 12-byte nonce. Format metadata is authenticated as AAD.

## Configuration and deployment

Set the repository Actions Secret `DASHBOARD_PASSWORD`. Never commit the password,
derived key or decrypted source. Pages uses the GitHub Actions deployment source.
The workflow decrypts into `.private/source`, updates metrics on schedule/manual runs,
re-encrypts and verifies the complete source round-trip, then stages an explicit public
file allowlist. A missing/incorrect Secret, failed API request, integrity check, commit,
or upload prevents deployment. Temporary decrypted sources are removed in an always step.

## Local editing

Supply `DASHBOARD_PASSWORD` only through the process environment, then run:

```powershell
node scripts/secure-build.mjs decrypt
# Edit the original files in .private/source.
# For a new Traffic snapshot, add a separate dated JSON file and rebuild the
# Traffic history within .private/source using scripts/build-traffic-history.mjs.
node scripts/secure-build.mjs encrypt
node --test scripts/*.test.mjs
node scripts/verify-public.mjs
```

Preview with a localhost HTTP server. The browser restores the original document
and scripts after authenticated decryption; protected datasets are never separate
public files. "Remember" stores the derived AES key and its salt identifier, not the
password. Without it, only the current tab session remembers the key. Relocking
removes both keys and reloads the public page. Clearing site data also forgets it.
Keys are intentionally reusable across data updates; changing passwords requires
decrypting with the old password and creating a new vault/salt before replacing the Secret.

`.private/`, local backups and environment files are ignored. The current source tree
and deployment artifact contain no protected plaintext. Historical Git commits and
previously downloaded copies are not rewritten or revoked by this change; history
cleanup must be handled separately.
