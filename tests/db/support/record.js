// Every matrix check produces one row: what actually happened (`allowed`),
// and what the intended permission model says should have happened
// (`expectedSecure`). `secure` is derived, not asserted -- a row where
// `secure: false` is not a bug in the harness, it's the harness doing its
// job (Task 3: "Capture CURRENT behavior, even when it is insecure").
function makeRecorder() {
  const results = [];
  function record({ area, action, identity, allowed, expectedSecure, note }) {
    if (typeof allowed !== 'boolean') throw new Error(`record(): allowed must be boolean (area=${area} action=${action})`);
    if (expectedSecure !== 'allow' && expectedSecure !== 'deny') throw new Error(`record(): expectedSecure must be 'allow'|'deny' (area=${area} action=${action})`);
    results.push({
      area,
      action,
      identity,
      allowed,
      expectedSecure,
      secure: allowed === (expectedSecure === 'allow'),
      note: note || '',
    });
  }
  return { record, results };
}

module.exports = { makeRecorder };
