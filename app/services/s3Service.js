var s3 = require('s3');
var logger = require('winston');

/**
 * Part of initialize. Connects to s3 based on '../config/s3Login'
 * adds a req.s3
 * @param req
 * @param res
 * @param next
 */
exports.initS3 = function(req, res, next){
  var s3config = {
    bucketName: req.config.s3bucketName,
    accessKeyId: req.config.s3accessKeyId,
    secretAccessKey: req.config.s3secretAccessKey,
    reqtion: req.config.s3region,
    sslEnabled: req.config.s3sslEnabled,
    maxRetries: req.config.s3maxRetries
  };

  var client = s3.createClient({
    maxAsyncS3: 20,     // this is the default
    s3RetryCount: 3,    // this is the default
    s3RetryDelay: 1000, // this is the default
    multipartUploadThreshold: 20971520, // this is the default (20 MB)
    multipartUploadSize: 15728640, // this is the default (15 MB)
    s3Options: s3config
  });

  req.s3 = client;
  next();
};

/**
 * Puts file from 'app/pdfs/' to s3 'historic/payments/'
 * @param client
 * @param file
 * @param callback
 */
exports.uploadPdf = function(client, file, callback){
  var params = {
    localFile: 'app/pdfs/' + file.pdfName,
    s3Params:{
      Bucket: req.config.s3bucketName,
      Key:'historic/payments/'+file.pdfName
    }
  };

  var uploader = client.uploadFile(params)
    .on('error',function(err){
      callback(err);
    })
    .on('end', function(){
      logger.log('trace','[s3] uploaded '+ file.pdfName +'to s3');
      callback();
    });
};

/**
 * Checks that the file it was uploading exists on s3
 */
exports.confirmUpload = function(){
  //todo
};
