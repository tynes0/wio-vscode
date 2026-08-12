"use strict";

const childProcess = require("node:child_process");

if (!process.env.WIO_TEST_EXECUTABLE) {
  console.error("WIO_TEST_EXECUTABLE must point to a Wio compiler executable.");
  process.exit(2);
}

const result = childProcess.spawnSync(
  process.execPath,
  ["--test", "./test/integration.test.js"],
  { cwd: process.cwd(), env: process.env, stdio: "inherit", windowsHide: true }
);
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
