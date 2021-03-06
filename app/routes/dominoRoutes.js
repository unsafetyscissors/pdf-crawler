var pageRequestService = require('../services/pageLoadRequests');
var phantomService = require('../services/phantomService');
var parsingService = require('../services/pageParsing');
var mysqlService = require('../services/mysqlService');
var s3Service = require('../services/s3Service');
var async = require('async');
var _ = require('underscore');
var logger = require('winston');
var scrapeService = require('../services/scrapeService');
var config = require('../config/config.json');
var request = require('request');
var theJar = request.jar();

exports.listingV2 = listingV2;

/**
 * ONLY gets a listing page and writes it to mysql.
 * @param req
 * @param res
 * @param next
 */
function listingV2(req, res, next){
  res.send('list scrape started');
  req.counter =0;

  async.whilst(
    //condition
    function(){ return req.counter < config.server.stoppingPos},

    //iterator
    function(whilstCallback) {
      async.waterfall([

          //scrape the listing page to get the next set of files
          function (waterfallCallback) {
            scrapeService.scrapeListingPage(req, function (scrapeError, startIndex) {
              req.counter = startIndex;
              waterfallCallback(scrapeError)
            });
          }
        ],

        //if batch fails, DONT pass error. just log and continue.
        function (waterfallError) {
          if (waterfallError) logger.error('Batch Failed : ' + req.counter, waterfallError);
          delete req.listing;

          whilstCallback(null);
        }
      );
    },

    //done
    function (whilstErr){
      if(whilstErr) return next(whilstErr);
      req.phantomServer.exit();
      logger.info('no pages left');
      next();
    }
  );
}







exports.raceTest = function(req, res, next){
  pageRequestService.testMysql(req.db, req.config.dominoListUrl, function(){});
};

exports.listing = function(req, res, next){
  //setup list page
  pageRequestService.loadListing(req.db, req.config.dominoListUrl, function(dbError, listRequest){

    //send request
    phantomService.loadPage(req.phantomServer, listRequest, function(loadError, loadPage){
      if (loadError) return next(loadError);

      //return all html
      loadPage.evaluate(
        function(){ return document.body.innerHTML },
        function(body){ parsingService.readListing('content', body, req.config.dominoBaseUrl, function(domError, pages){
          if (domError) return next(domError);

          req.listing = pages;
          return next();
        })}
      );
    });
  });
};

exports.listingAll = function(req, res, next){
  res.send('list scrape started');
  req.counter =0;

  async.whilst(
    //condition
    function(){ return req.counter < config.server.stoppingPos},

    //iterator
    function(whilstCallback) {
      async.waterfall([

          //scrape the listing page to get the next set of files
          function (waterfallCallback) {
            scrapeService.scrapeListingWithRequest(req, function (scrapeError, startIndex) {
              req.counter = startIndex;
              waterfallCallback(scrapeError)
            });
          },

          //scrape each page to get pdfs and attachment data
          function(waterfallCallback){
            scrapeService.scrapeListingPageWithRequest(req, waterfallCallback);
          }

        ],

        //if batch fails, DONT pass error. just log and continue.
        function (waterfallError) {
          if (waterfallError) logger.error('Batch Failed : ' + req.counter, waterfallError);
          delete req.listing;

          whilstCallback(null);
        }
      );
    },

    //done
    function (whilstErr){
      if(whilstErr) return next(whilstErr);
      req.phantomServer.exit();
      logger.info('no pages left');
      next();
    }
  );
};


/*
exports.pdfPage = function(pageData, callback){
  async.waterfall(
    [
      pageRequestService.loadPage,

      phantomService.loadPage,

      loadPage.evaluate,

      parsingService.readPageForAttachments,

      phantomService.pdfPage,

      mysqlService.saveListRecord
    ],

    //on waterfall end
    function(waterfallError){
      eachCallback(waterfallError);
    }
  )
};
*/
/*
exports.scrapePdf = function(req, res, next){

  async.eachSeries(req.listing, function(pageData, eachCallback){
    async.waterfall([

      //get the http request obj and load teh page
      function(waterfallCallback){
        var pageRequest = pageRequestService.loadPage(pageData);
        if(!pageRequest) return waterfallCallback(new Error('failed to create pageData: ' + JSON.stringify(pageData)));

        phantomService.loadPage(req.phantomServer, pageRequest, function(loadError, loadPage) {
          waterfallCallback(loadError, loadPage);
        });
      },

      //pdf the pages
      function(loadPage, waterfallCallback){
        phantomService.pdfPage(null, loadPage, pageData, function(pdfError, savedData){
          if (pdfError) return waterfallCallback(pdfError);

          mysqlService.saveListRecord(req.db, savedData, function (saveError) {
            waterfallCallback(saveError, loadPage);
          });
        })
      },

      //get the attachment data
      function(loadPage, waterfallCallback){
        loadPage.evaluate(
          function(){return document.body.innerHTML},
          function(body){
            parsingService.readPageForAttachments(body, pageData, function(parseError, attachments) {
              waterfallCallback(parseError, loadPage, attachments);
            });
          }
        );
      },

      function(loadPage, attachments, waterfallCallback){

        async.each(attachments,
          function(attachment, nextAttachment){
            var firstUrl = (attachment.type=='javascript')?attachment.url:attachment.href;

            req.phantomServer.createPage(function(attachmentPage){
              attachmentPage.open(firstUrl);
              if(attachment.type=='javascript'){
                attachmentPage.includeJs("http://ajax.googleapis.com/ajax/libs/jquery/1.6.1/jquery.min.js", function() {
                  attachmentPage.evaluate(
                    //on the web page
                    function () {
                      $('a').click();
                      setTimeout(function(){
                        return window.location.href;
                      }, 100)

                    },

                    //response
                    function (windowHref) {
                      attachmentPage.render('app/pdfs/jsPage' + (new Date).getTime() + '.jpg');
                      nextAttachment();
                    }
                  );
                });

              }else{
                attachmentPage.render('app/pdfs/attachmentPage' + (new Date).getTime()+'.jpg');
                nextAttachment();
              }
            });

          },
          function(attachErr){
            waterfallCallback();
          }
        );
      }


    ], function(waterfallErr){
      return eachCallback(waterfallErr);
    });

  }, function(callbackError){
    if(callbackError) return next(callbackError);
    return next();
  });
};


*/
/*
exports.scrapePdfOg = function(req, res, next){
  async.eachSeries(req.listing, function(pageData, eachCallback){
    var pageRequest = pageRequestService.loadPage(pageData);
    if(!pageRequest) return next(new Error('failed to create pageData: ' + JSON.stringify(pageData)));

    phantomService.loadPage(req.phantomServer, pageRequest, function(loadError, loadPage){
      if(loadError) return eachCallback(loadError);

      //return all html
      loadPage.evaluate(
        function(){return document.body.innerHTML},
        function(body){parsingService.readPageForAttachments(body, pageData, function(parseError, attachments){
          if(parseError) return eachCallback(parseError);

          phantomService.pdfPage(loadError, loadPage, pageData, function(pdfError, savedData){
            if (pdfError) return eachCallback(pdfError);

            mysqlService.saveListRecord(req.db, savedData, function (saveError) {
              eachCallback(saveError);
            });
          })
        })}
      );

    });
    /*
     phantomService.loadPage(req.phantomServer, pageRequest,
     phantomService.pdfPage.bind(null, pageData, function(pdfError, savedData){
     if (pdfError) return eachCallback(pdfError);

     mysqlService.saveListRecord(req.db, savedData, function (saveError) {
     eachCallback(saveError);
     });
     })
     );
     */
/*
  }, function(callbackError){
    if(callbackError) return next(callbackError);
    return next();
  });
};
*/

exports.pdfPages = function(req, res, next){
  async.eachSeries(req.listing, function(pageData, eachCallback){
    async.waterfall([

      //load new page
      function(waterfallCallback){
        var pageRequest = pageRequestService.loadPage(pageData);
        if(!pageRequest) return next(new Error('failed to create pageData ' + JSON.stringify(pageData)));

        phantomService.loadPage(req.phantomServer, pageRequest, function(loadError, loadPage){
          waterfallCallback(loadError, loadPage);
        })
      },

      //pdf the page and save the scraped data+pdf url
      function(loadPage, waterfallCallback){
        phantomService.pdfPage(null, loadPage, pageData, function(pdfError, savedData){
          if (pdfError) return waterfallCallback(pdfError);

          mysqlService.saveListRecord(req.db, savedData, function (saveError) {
            waterfallCallback(saveError, loadPage);
          });
        })
      },

      //get attachment data
      function(loadPage, waterfallCallback){
        loadPage.evaluate(
          function(){return document.body.innerHTML},
          function(body){
            parsingService.readPageForAttachments(body, pageData, req.config.dominoBaseUrl, function(parseError, attachments) {
              waterfallCallback(parseError, loadPage, attachments);
            });
          }
        );
      },

      //save the attachment data
      function(loadPage, attachments, waterfallCallback){
        mysqlService.saveAttachRecord(req.db, attachments, function(saveError){
          waterfallCallback(saveError);
        })
      }
    ], eachCallback);
  }, next);
};

/*
exports.pdfPagesV1 = function(req, res, next){
  async.eachSeries(req.listing, function(pageData, eachCallback){
    var pageRequest = pageRequestService.loadPage(pageData);
    if(!pageRequest) return next(new Error('failed to create pageData: ' + JSON.stringify(pageData)));

    phantomService.loadPage(req.phantomServer, pageRequest, function(loadError, loadPage){
      if(loadError) return eachCallback(loadError);

      //return all html
      loadPage.evaluate(
        function(){return document.body.innerHTML},
        function(body){parsingService.readPageForAttachments(body, pageData, function(parseError, attachments){
          if(parseError) return eachCallback(parseError);

          phantomService.pdfPage(loadError, loadPage, pageData, function(pdfError, savedData){
            if (pdfError) return eachCallback(pdfError);

            mysqlService.saveListRecord(req.db, savedData, function (saveError) {
              eachCallback(saveError);
            });
          })
        })}
      );

    });
  }, function(callbackError){
    if(callbackError) return next(callbackError);
    return next();
  });
};
*/
exports.uploadPages = function(req, res, next){
  async.eachSeries(req.listing, function(pageData, eachCallback){
    s3Service.uploadPdf(req.s3, pageData, eachCallback);
  }, function(callbackError){
    next(callbackError)
  });
};

exports.auth = function(req, res, next){

  //setup auth request
  var authRequest = pageRequestService.authenticate(req.config);

  //send request
  phantomService.loadPage(req.phantomServer, authRequest, function(loadError, loadPage){
    loadPage.close();
    next(loadError);
  });

};

exports.authWithRequest = function(req, res, next){
  //setup auth request, {url, method, data}
  var authRequest = pageRequestService.authenticate(req.config);
  var loginUrl = 'https://securercuh01.rcuh.com/names.nsf?Login';

  req.io.emit('alert', 'logging into '+loginUrl);
  req.loginCookies = theJar;
  request.post({url:loginUrl,jar:req.loginCookies, form:{Username:'accounting',Password:'regul8tr$'}}, function(reqError, reqResponse, reqBody){
    next(reqError);
  })
};

exports.cleanUp = function(req, res, next){
  var tempDir ='app/pdfs';
  var exec = require('child_process').exec, child;
  child = exec('rm app/pdfs/*', function(err, out){
    if(out) logger.info('[server] '+out);
    if(err) return next(err);

    req.phantomServer.exit();
    logger.info('[server] stopping phantom');

    req.db.end(function(dbErr){
      if(dbErr) return next(dbErr)
      logger.info('[server] stopping mysql');
    })
  });
};

exports.scrapeAll = function(req, res, next){
  //send res to prevent timeout. orphans this process to run until its done
  res.send('scrape started.');
  req.counter = 0;

  async.whilst(
    //condition
    function(){ return req.counter < 13053;},
    //function(){return counter < 200},

    //iterator
    function(whilstCallback){
      async.waterfall([

          //start phantom
          function(waterfallCallback){
            phantomService.startServer(req, waterfallCallback);
          },

          //auth
          function(waterfallCallback){
            //setup auth request
            var authRequest = pageRequestService.authenticate(req.config);

            //send request
            phantomService.loadPage(req.phantomServer, authRequest, function(loadError, loadPage){
              loadPage.close();
              waterfallCallback(loadError);
            });
          },

          //scrape the listing page to get the next set of files
          function(waterfallCallback){
            scrapeService.scrapeListing(req, function(scrapeError, startIndex){
              req.counter = startIndex;
              waterfallCallback(scrapeError)
            });
          },

          //scrape each page on the listing page to pdf
          function(waterfallCallback){
            scrapeService.scrapeListingPages(req, waterfallCallback);
          },

          //check file size is in acceptable range
          function(waterfallCallback){
            scrapeService.confirmFilePdfs(req, waterfallCallback);
          },

          //upload the files
          function(waterfallCallback) {
            scrapeService.uploadScrapedPages(req, waterfallCallback);
          },

          //delete from temp local storage
          function(waterfallCallback){
            scrapeService.cleanUp(req, waterfallCallback);
          }
        ],

        //if batch fails, DONT pass error. just log and continue.
        function(waterfallError){
          if(waterfallError) logger.error('Batch Failed',waterfallError);
          delete req.listing;

          //end phantom
          req.phantomServer.exit();

          whilstCallback(null);
        }
      );
    },

    //done
    function (whilstErr){
      if(whilstErr) return next(whilstErr);
      logger.info('no pages left');
      next();
    }
  );
};