const debug = require('debug')('codepress:scenario-repository');
const path = require('path');
const chokidar = require('chokidar');

const throttled = require('../model/throttling');
const codeceptjsFactory = require('../model/codeceptjs-factory');
const wsEvents = require('../model/ws-events');

const stripTags = title => {
  const parts = title.split('|');
  const titleWithoutData = parts[0];
  return titleWithoutData.replace(/(^|\s)@[^\s]+/gi, '');
}
const extractTags = title => {
  const m = title.match(/(^|\s)+@[^\s]+/g);
  return m && m.map(str => str.replace('@', '').trim());
}
const extractData = title => {
  const parts = title.split('|').map(p => p && p.trim());
  return parts[1];
}
const makeRelativePath = filePath => filePath.replace(process.cwd(), '').replace(/\\/g, '/');
const ascending = (a, b) => {
  const aTitle = a.feature ? a.feature.title.toLowerCase() : a.title.toLowerCase();
  const bTitle = b.feature ? b.feature.title.toLowerCase() : b.title.toLowerCase();
  if (aTitle > bTitle) return 1;
  if (aTitle < bTitle) return -1;
  return 0;
};
const matchSearchTerms = (matchType, str, regexes) => 
  matchType === 'all' ? regexes.every(re => str.match(re)) : regexes.some(re => str.match(re));
const featureOrOneOfItsScenariosMatchesQuery = (q, matchType, feature) => {
    if (!q) return true;
    matchType = matchType || 'all';

    const searchREs = q.split(/\s+/).map(searchTerm => new RegExp(searchTerm, 'gi'));
    const matchingScenarios = feature.scenarios.filter(scenario => matchSearchTerms(matchType, scenario.orgTitle, searchREs));
    
    return matchSearchTerms(matchType, feature.feature.title, searchREs) || matchingScenarios.length > 0;
}
const groupByAttribute = attrName => (grouped, feature) => {
  const groupKey = feature[attrName];
  grouped[groupKey] ? grouped[groupKey].push(feature) : grouped[groupKey] = [feature];
  return grouped;
}

// Cache mocha suites
let suites = [];

// NOTE could not get it to work with absolute paths
// TODO Setting the default ignore pattern in my cases effectively disabled events
//    my test files are ending with *.test.js
chokidar.watch('./**/*.js', {
  ignored:  ['**/node_modules/**/*', '**/.git/**/*'],
  ignoreInitial: false, // need to load suites initially
  ignorePermissionErrors: true,
  followSymlinks: false,
  interval: 500,
  depth: 10,
  awaitWriteFinish: true
}).on('all', throttled(500, (event, fileRelPath) => {
  debug('A source file has changed. Scenarios will be updated:', event, fileRelPath);
  
  codeceptjsFactory.unrequireFile(fileRelPath);
  // cleanupModule(fileRelPath);
  codeceptjsFactory.reloadConfigIfNecessary(fileRelPath);

  // if (fileRelPath === codeceptjsFactory.getConfigFile()) {
  //   reloadConfig();
  // }
  
  codeceptjsFactory.reloadSupportObjectIfNecessary(fileRelPath);
    
  try {
    suites = codeceptjsFactory.reloadSuites();

    // Tell client that scenarios have been updated. Client must fetch.
    wsEvents.codeceptjs.scenariosUpdated();
  } catch (err) {
    debug('Scenarios could not be loaded. There is probably a syntax error in one of your test files. Please check the stacktrace of the error: ', err);
    wsEvents.codeceptjs.scenariosParseError(err);
  }
}));

const getFeatures = (searchQuery, opts = {}) => {
    const features = [];

    for (const suite of suites) {
      const feature = {
        feature: {
          title: stripTags(suite.title), 
          tags: extractTags(suite.title),
          orgTitle: suite.title,
        },
        file: suite.file,
        fileBaseName: path.basename(suite.file),
        fileRelDir: makeRelativePath(path.dirname(suite.file)),
        fileRelPath: makeRelativePath(suite.file),
        scenarios: [],
      };
  
      for (const test of suite.tests) {
        feature.scenarios.push({
          id: test.id,
          pending: test.pending,
          title: stripTags(test.title),
          data: extractData(test.title),
          tags: extractTags(test.title),
          orgTitle: test.fullTitle(),
          body: opts.full && test.body,
        })
      }
  
      features.push(feature);
    }
  
    const filteredFeatures = 
      features.filter(feature => featureOrOneOfItsScenariosMatchesQuery(searchQuery, opts.matchType, feature));

    filteredFeatures.sort();

    return filteredFeatures;
}

const getScenario = (scenarioId) => {
    const features = getFeatures('', { full: true });

    return features
        .map(f => f.scenarios.find(s => s.id === scenarioId))
        .filter(f => !!f)[0];
}

// function reloadConfig() {
//   const { config, container } = codeceptjsFactory.getInstance();
//   config.reset();
//   config.load(codeceptjsFactory.getConfigFile());  
//   const helpersConfig = config.get('helpers');
//   for (const helperName in container.helpers()) {
//     if (helpersConfig[helperName]) {
//       container.helpers(helperName)._setConfig(helpersConfig[helperName]);
//     }
//   }

//   Object.keys(config.get('include')).forEach(s => cleanupSupportObject(s));

//   debug('Updated config file. Refreshing...', )
// }

// function cleanupSupportObject(supportName) {
//   const { container, config } = codeceptjsFactory.getInstance();
//   const includesConfig = config.get('include');
//   if (!includesConfig[supportName]) return;
//   const support = container.support();
//   delete support[supportName];
// }

// function cleanupModule(moduleName){
//   moduleName = path.join(codeceptjsFactory.getRootDir(), moduleName);
//   if (require.cache[require.resolve(moduleName)]) delete require.cache[require.resolve(moduleName)]
// }

const groupFeaturesByCapability = features => {
  const groupedFeatures = features.reduce(groupByAttribute('fileRelDir'), {});
  Object.keys(groupedFeatures).forEach(key => {
    groupedFeatures[key].sort(ascending); 
    groupedFeatures[key].forEach(feature => feature.scenarios.sort(ascending));
  });
  return groupedFeatures;
}

module.exports = {
    getFeatures,
    getScenario,
    groupFeaturesByCapability
}