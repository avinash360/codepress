const scenarioRepository = require('../model/scenario-repository');
const codeceptjsFactory = require('../model/codeceptjs-factory');
const { config } = codeceptjsFactory.getInstance();

module.exports = (req, res) => {
  const searchQuery = req.query.q;
  const matchType = req.query.m || 'all';

  const features = scenarioRepository.getFeatures(searchQuery, { matchType });

  res.send({
    name: config.get('name'),
    features: scenarioRepository.groupFeaturesByCapability(features),
  });
}
