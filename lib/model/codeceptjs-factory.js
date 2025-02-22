const debug = require('debug')('codepress:codeceptjs-factory');
const path = require('path');

// codepress must be run in testproject dir
const TestProject = process.cwd();

const container = require('codeceptjs').container;
const Codecept = require('codeceptjs').codecept;
const config = require('codeceptjs').config;

const defaultOpts = { };

// current instance
let instance;

// const loadRealtimeReporter = container => {
//   debug('Loading realtime helper...')
//   const RealtimeReporterHelper = require('../codeceptjs/realtime-reporter.helper')
//   const reporter = new RealtimeReporterHelper();
//   reporter._init();

//   container.append({
//     helpers: {
//       RealtimeReporterHelper: reporter
//     }
//   });
// }

module.exports = new class CodeceptjsFactory {
  constructor(configFile = 'codecept.conf.js') {
    this.configFile = configFile;
  }

  loadRealtimeReporter() {
    debug('Loading realtime helper...')
    const RealtimeReporterHelper = require('../codeceptjs/realtime-reporter.helper')
    const reporter = new RealtimeReporterHelper();
    reporter._init(); 
    return {
      helpers: {
        RealtimeReporterHelper: reporter
      }
    }
  }

  getInstance() {
    if (!instance) instance = this.create();
    return instance;
  }

  getConfigFile() {
    return this.configFile;
  }

  getRootDir() {
    return TestProject;
  }

  create(cfg = {}, opts = {}) {
    debug('Creating codeceptjs instance...');

    config.reset();
    config.load(path.join(TestProject, this.configFile))
    config.append(cfg);
    cfg = config.get();

    debug('Using CodeceptJS config', cfg);

    container.clear();
    // create runner
    const codecept = new Codecept(cfg, opts = Object.assign(opts, defaultOpts));
    
    // initialize codeceptjs in current TestProject
    codecept.initGlobals(TestProject);

    // create helpers, support files, mocha
    container.create(cfg, opts);

    const rrtConfig = this.loadRealtimeReporter(container);
    container.append(rrtConfig);

    // load tests
    debug('Loading tests...');
    codecept.loadTests(cfg.tests);
    
    debug('Running hooks...');
    codecept.runHooks();

    return {
      config,
      codecept,
      container,
    }
  }

  unrequireFile(filePath) {
    filePath = path.join(this.getRootDir(), filePath);
    if (require.cache[require.resolve(filePath)]) {
      delete require.cache[require.resolve(filePath)];
    }
  }

  resetSuites() {
    const { container } = this.getInstance();
    const mocha = container.mocha();

    mocha.unloadFiles();  
    mocha.suite.cleanReferences();
    mocha.suite.suites = [];
  }

  reloadSuites() {
    const { container, codecept } = this.getInstance();

    const mocha = container.mocha();

    this.resetSuites();

    // Reload
    mocha.files = codecept.testFiles; 
    mocha.loadFiles();
    
    return mocha.suite.suites;  
  }

  cleanupSupportObject(supportName) {
    const { container, config } = this.getInstance();
    const includesConfig = config.get('include');
    if (!includesConfig[supportName]) return;
    const support = container.support();
    delete support[supportName];
  }

  reloadConfigIfNecessary(filePath) {
    if (filePath === this.getConfigFile()) {
      const { config, container } = this.getInstance();
      config.reset();
      config.load(this.getConfigFile());  
      const helpersConfig = config.get('helpers');

      for (const helperName in container.helpers()) {
        if (helpersConfig[helperName]) {
          container.helpers(helperName)._setConfig(helpersConfig[helperName]);
        }
      }
    
      Object.keys(config.get('include')).forEach(s => this.cleanupSupportObject(s));
    
      debug('Updated config file. Refreshing...', );
    }  
  }

  reloadSupportObjectIfNecessary(filePath) {
    const { config } = this.getInstance();
    // if it is a support object => reinclude it
    Object.entries(config.get('include'))
      .filter(e => e[1] === path.join(this.getRootDir(), filePath))
      .forEach(e => this.cleanupSupportObject(e[0]));
  }
};
