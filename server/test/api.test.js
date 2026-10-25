const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/server');

async function withServer(callback) {
  const server = app.listen(0);
  try {
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

async function login(baseUrl, role) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: `${role}@signalforge.demo`,
      password: 'DemoPass123!',
      role
    })
  });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';')[0];
}

test('health endpoint reports controlled demo mode when MongoDB is absent', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
  });
});

test('unauthenticated reports are rejected', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/reports`);
    assert.equal(response.status, 401);
  });
});

test('tester retest transitions the issue to the matching workflow state', async () => {
  await withServer(async (baseUrl) => {
    const cookie = await login(baseUrl, 'tester');
    const response = await fetch(`${baseUrl}/api/reports/report-3/retests`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ result: 'Pass', details: 'Verified in the released build.' })
    });
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(body.retest.result, 'Pass');

    const reportResponse = await fetch(`${baseUrl}/api/reports/report-3`, { headers: { cookie } });
    assert.equal((await reportResponse.json()).report.status, 'Verified');
  });
});

test('invalid report identifiers return not found instead of a server error', async () => {
  await withServer(async (baseUrl) => {
    const cookie = await login(baseUrl, 'developer');
    const response = await fetch(`${baseUrl}/api/reports/not-a-real-report`, { headers: { cookie } });
    assert.equal(response.status, 404);
  });
});
