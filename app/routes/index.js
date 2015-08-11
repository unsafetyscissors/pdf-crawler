var bodyParser = require('body-parser');
var server = require('./serverRoutes');
var domino = require('./dominoRoutes');
var mysqlService = require('../services/mysqlService');
var s3Service = require('../services/s3Service');


exports.addRoutes = function(app){
  app.use(bodyParser.json({limit:1024*1024*100}));
  app.use(mysqlService.initDb, s3Service.initS3);

  app.get('/', server.healthCheck);
  app.get('/raceTest', domino.raceTest);
  app.get('/listing', server.initPhantom, domino.authWithRequest, domino.listingAll);
  app.get('/scrapePages', domino.scrapeAll);//domino.listing, domino.pdfPages, domino.uploadPages);
  //app.get('/testJs', domino.listing, domino.scrapePdf, domino.stopping); //domino.uploadPages, domino.cleanUp);

  //app.use( domino.cleanUp);
  app.use(server.errorCheck);
};