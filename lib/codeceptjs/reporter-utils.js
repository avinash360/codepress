const debug = require('debug')('codepress:reporter-utils');
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const toString = sth => {
  if (typeof sth === 'string') return sth
  if (typeof sth === 'object') return JSON.stringify(sth)
  return '' + sth
}
const toError = err => {
  assert(err, 'err is required');

  let message = err.message;
  if (err.inspect) { // AssertionFailedError
    message = err.message = err.inspect()
  }
  message = toString(message)

  return {
    name: err.name,
    message,
    hash: hashString(message, err.stack),
    stack: err.stack,
    actual: err.actual,
    expected: err.expected,
    operator: err.operator
  }
}

const hashString = (...args) => {
  const str = args.join('-')
  const hash = crypto.createHash('sha1');
  hash.setEncoding('hex');
  hash.write(str);
  hash.end();
  return hash.read();
}

const isSnapshotStepBefore = (step) => {
  if (step.name.startsWith('click') || step.name.startsWith('double')) return true;
  if (step.name.startsWith('switch')) return true; // trigger a force snapshot on the next step
  if (step.name.startsWith('scroll')) return true; // make sure we have a screenshot after the scroll
  return false;
}

const isSnapshotStep = (step) => {
  // TODO grab... should be a snapshot step if the step before did NOT take a screenshot
  if (step.name.startsWith('click') || step.name.startsWith('double')) return true;
  if (step.name.indexOf('tap') >= 0) return true;
  if (step.name.indexOf('see') >= 0) return true;
  if (step.name.indexOf('dontSee') >= 0) return true;
  if (step.name.indexOf('swipe') >= 0) return true;
  if (step.name.indexOf('fillField') >= 0) return true;
  if (step.name.indexOf('selectOption') >= 0) return true;
  if (step.name.indexOf('amOnPage') >= 0) return true;
  if (step.name.indexOf('saveScreenshot') >= 0) return true;
  if (step.name.startsWith('execute')) return true;
  return false;
}

const isRetvalStep = step => {
  // TODO Need to map retrun values (e. g. axios responses)
  if (step.name.startsWith('send')) return true;
  // if (step.name.startsWith('grab')) return true;
  return false;
}

const getRetval = async (step, retvalPromise) => {
  let retval;
  if (retvalPromise) {

    try {
      retval = await retvalPromise;
      if (retval) {
        if (step.name.startsWith('send')) {
          retval = retval.data;
        }
      }
    } catch (err) {
      debug('ERROR getting retval in step', step.name);
     }
  }
  return retval;
}

const isScreenshotStep = (step) => {
  // TODO Better use existing screenshot from saveScreenshot
  if (step.name.indexOf('saveScreenshot') >= 0) return true;
  return false;
}

/**
 * Grab html source from current iframe
 */
const grabSource = async helper => {
  // TODO This is puppeteer specific, so make that work with other helpers
  if (helper.context && helper.context.content) {
    return helper.context.content();
  }
  return helper.grabSource();
}

const getViewportSize = function() {
  return {
      width: Math.max(document.documentElement.clientWidth, window.innerWidth || 0),
      height: Math.max(document.documentElement.clientHeight, window.innerHeight || 0)    
  }
}

/**
 * Take an HTML snapshot
 * @param {*} helper 
 * @param {*} snapshotId 
 * @param {*} takeScreenshot 
 */
const takeSnapshot = async (helper, snapshotId, takeScreenshot = false) => {
  assert(helper, 'helper is required');
  assert(snapshotId, 'snapshotId is required');

  const HelperName = helper.constructor.name;
  const StepFileName = '_step_screenshot.png';

  let source, pageUrl, pageTitle, scrollPosition, viewportSize;

  // TODO catch errors and retry?
  [_, source, pageUrl, pageTitle, scrollPosition, viewportSize] = await Promise.all([
      takeScreenshot ? helper.saveScreenshot(StepFileName) : Promise.resolve(undefined),
      grabSource(helper),
      helper.grabCurrentActivity ? await helper.grabCurrentActivity() : await helper.grabCurrentUrl(),
      helper.grabTitle(),
      helper.grabPageScrollPosition(),
      helper.executeScript(getViewportSize),
  ]);

  const snapshot = {
    id: snapshotId,
    screenshot: takeScreenshot ? fs.readFileSync(path.join(global.output_dir, StepFileName)) : undefined,
    scrollPosition,
    source,
    sourceContentType: HelperName === 'Appium' ? 'xml' : 'html',
    pageUrl,
    pageTitle,
    viewportSize,
  };

  return snapshot;
}

/**
 * Filter step stacktrace
 */
const filterStack = step => {
  const stackFrames = step.stack.split('\n');
  const stackFramesOfProject = stackFrames
    .filter(sf => sf && sf.includes(process.cwd())) // keep only stackframes pointing to source within the test project
  ; 

  const cwd = process.cwd();

  return {
    stackFrameOfStep: stackFramesOfProject.find(sf => sf.includes(cwd)),
    stackFrameInTest: stackFramesOfProject.find(sf => sf.includes('Test.Scenario') || sf.includes('Test.<anonymous>'))
  }
}

/**
 * Safe version of stringify to serialize circular objects
 */
const stringifySafe = (o) => {
  let cache = [];
  const ret = JSON.stringify(o, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.indexOf(value) !== -1) {
        // Duplicate reference found, discard key
        return;
      }
      // Store value in our collection
      cache.push(value);
    }
    return value;
  });
  cache = null; // Enable garbage collection
  return ret;
}

module.exports = {
  toString,
  toError,
  hashString,
  isRetvalStep,
  getRetval,
  isSnapshotStep,
  isSnapshotStepBefore,
  isScreenshotStep,
  takeSnapshot,
  filterStack,
  stringifySafe
}
