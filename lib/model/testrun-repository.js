const debug = require('debug')('codepress:testRunRepository');
const fs = require('fs');
const path = require('path');
const mkdir = require('../utils/mkdir');

mkdir(path.join('.', '.codepress'));
const TestRunBaseDir = path.join('.', '.codepress', 'testruns');
mkdir(TestRunBaseDir);

const fileNameFromId = id => `${encodeURIComponent(id)}.json`;

module.exports = {
  saveTestRun(id, testRun) {
    debug(`Saving testrun ${id}`);
    fs.writeFileSync(path.join(TestRunBaseDir, fileNameFromId(id)), JSON.stringify(testRun), 'utf8');
  },

  getTestRun(id) {
    const testRunFile = path.join(TestRunBaseDir, fileNameFromId(id));
    if (!fs.existsSync(testRunFile)) return;

    debug(`Retrieving testrun ${id}`);
    const testRunAsString = fs.readFileSync(testRunFile);
    return JSON.parse(testRunAsString);
  }
}