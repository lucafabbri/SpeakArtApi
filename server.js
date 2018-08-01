'use strict';

const btoa = require('btoa');
const Hapi=require('hapi');
const fs = require('fs');
const request = require('request');
const PNG = require('pngjs').PNG;
const pixelmatch = require('pixelmatch');
const im = require('imagemagick');

const download = async function(uri, filename, callback){
  await request.head(uri, async function(err, res, body){
    console.log('content-type:', res.headers['content-type']);
    console.log('content-length:', res.headers['content-length']);

    await request(uri).pipe(fs.createWriteStream(filename+'.jpg')).on('close', callback);
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
    path: '/prepare',
    handler: async function(request,h){
        var load = request.payload;
        await download(load.urlOriginal, __dirname+'/originals/'+load.job, async function(){
            console.log('done download A');
            await im.convert([__dirname+'/originals/'+load.job+'.jpg',__dirname+'/originals/'+load.job+'.png'], 
                function(err, stdout){
                if (err) throw err;
                    console.log('stdout:', stdout);
                });
        });
        await download(load.urlNew, __dirname+'/news/'+load.job, async function(){
            console.log('done download B');
            await im.convert([__dirname+'/news/'+load.job+'.jpg',__dirname+'/news/'+load.job+'.png'], 
                function(err, stdout){
                if (err) throw err;
                    console.log('stdout:', stdout);
                });
        });
        return {"message":"job started"};
    }
});
server.route({
    method: 'POST',
    path: '/compare',
    handler: async function(request,h){
        var load = request.payload;
        // var original = __dirname+'/originals/'+load.job+'.png';
        // var thenew = __dirname+'/news/'+load.job+'.png';
        var original = load.urlOriginal;
        var thenew = load.urlNew;
        if(fs.existsSync()&&fs.existsSync()){

            console.log("loading files");

            var img1 = fs.createReadStream(original).pipe(new PNG()).on('parsed', doneReading),
                img2 = fs.createReadStream(thenew).pipe(new PNG()).on('parsed', doneReading),
                filesRead = 0;

            function doneReading() {
                console.log("files loaded "+filesRead+" for comparing");
                if (++filesRead < 2) return;
                console.log("files loaded "+filesRead+" for comparing");
                var diff = new PNG({width: img1.width, height: img1.height});
                console.log("ready for pixel matching");
                var pmresult = pixelmatch(img1.data, img2.data, diff.data, img1.width, img1.height, {threshold: load.maxThreshold});
                console.log(pmresult+" of "+img1.width*img1.height+" pixels found different, saving");
                diff.pack().pipe(fs.createWriteStream(load.job));
            }
            return {"message":"compare started"};
        }
        else
        {
            return { "error":"JOB_IS_NOT_OVER","message":"Image upload is not completed yet"};
        }
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