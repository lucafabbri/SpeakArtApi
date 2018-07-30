'use strict';

const btoa = require('btoa');
const Hapi=require('hapi');
const Rembrandt = require('rembrandt');
const fs = require('fs');
const request = require('request');
const tempy = require('tempy');

const download = async function(uri, filename, callback){
  await request.head(uri, async function(err, res, body){
    console.log('content-type:', res.headers['content-type']);
    console.log('content-length:', res.headers['content-length']);

    await request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
  });
};

// Create a server with a host and port
const server=Hapi.server({
    host:'localhost',
    port:8000
});

// Add the route
server.route({
    method:'GET',
    path:'/hello',
    handler:function(request,h) {

        return'hello world';
    }
});

server.route({
    method: 'POST',
    path: '/compare',
    handler: async function(request,h){
        var load = request.payload;
        await download(load.urlOriginal, __dirname+'/originals/original.jpg', function(){
            console.log('done download A');
        });
        await download(load.urlNew, __dirname+'/news/new.jpg', function(){
            console.log('done download B');
        });
          
        var rembrandt = new Rembrandt({
            // `imageA` and `imageB` can be either Strings (file path on node.js,
            // public url on Browsers) or Buffers
            imageA: __dirname+'/originals/original.jpg',
            imageB: __dirname+'/news/new.jpg',
           
            // Needs to be one of Rembrandt.THRESHOLD_PERCENT or Rembrandt.THRESHOLD_PIXELS
            thresholdType: (load.thresholdType==="THRESHOLD_PERCENT")?Rembrandt.THRESHOLD_PERCENT:Rembrandt.THRESHOLD_PIXELS,
           
            // The maximum threshold (0...1 for THRESHOLD_PERCENT, pixel count for THRESHOLD_PIXELS
            maxThreshold: load.maxThreshold,
           
            // Maximum color delta (0...255):
            maxDelta: load.maxColorDelta,
           
            // Maximum surrounding pixel offset
            maxOffset: load.maxPixelOffset,
           
            renderComposition: true, // Should Rembrandt render a composition image?
            compositionMaskColor: Rembrandt.Color.RED // Color of unmatched pixels
          })
          return await rembrandt.compare()
            .then(function (result) {
                return {
                    "image":"data:image/png;base64,"+btoa(String.fromCharCode.apply(null, new Uint8Array(result.compositionImage))), 
                    "differences":result.differences, 
                    "passed":result.passed, 
                    "percentageDifferences": result.percentageDifference
                }
            })
            .catch((e) => {
                console.error(e)
            });
    }
});

// Start the server
async function start() {

    try {
        await server.start();
    }
    catch (err) {
        console.log(err);
        process.exit(1);
    }

    console.log('Server running at:', server.info.uri);
};

start();