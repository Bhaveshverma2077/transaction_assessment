const morgan = require('morgan');

const requestLogger = morgan(process.env.NODE_ENV === 'test' ? 'tiny' : 'dev', {
  skip: () => process.env.NODE_ENV === 'test',
});

module.exports = requestLogger;
